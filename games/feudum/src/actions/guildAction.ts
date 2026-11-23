import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { GuildIds, type GuildId } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { markRevealsInfo } from '../definition/revealing.js'
import {
    GuildFunctionNames,
    GuildFunctionOutcome,
    GuildFunctionParams,
    GuildFunctionSchema,
    markGuildUsed,
    pointsFor,
    reasonGuildUsedRefused,
    reasonRankRefused,
    type GuildFunctionName
} from '../guilds/guildFunction.js'
import {
    guildFunctionPreview,
    guildFunctionRow,
    performGuildFunction,
    type GuildFunctionPreview
} from '../guilds/registry.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { GuildIdSchema } from '../model/stateSchemas.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

export type GuildActionMetadata = GuildFunctionOutcome
export const GuildActionMetadata = GuildFunctionOutcome

export type GuildAction = Type.Static<typeof GuildAction>
export const GuildAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.GuildAction),
            playerId: Type.String(),
            metadata: Type.Optional(GuildActionMetadata),
            /** R-3.16.1 */
            guildId: GuildIdSchema,
            fn: GuildFunctionSchema,
            params: GuildFunctionParams
        })
    ])
)

export const GuildActionValidator = Compile(GuildAction)

export function isGuildAction(action?: GameAction): action is GuildAction {
    return action?.type === ActionType.GuildAction
}

export interface GuildActionInput extends CardPlayInput {
    readonly guildId: GuildId
    readonly fn: GuildFunctionName
    readonly params: GuildFunctionParams
}

/** R-3.16.1, R-3.16.2, R-4.6.1 */
export function reasonGuildActionRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: GuildActionInput
): string | undefined {
    const { guildId, fn, params } = input
    const actor = { playerId }
    const row = guildFunctionRow(guildId, fn)
    return (
        reasonCardPlayRefused(state, playerId, 'guild', input) ??
        reasonGuildUsedRefused(state, playerId, guildId) ??
        reasonRankRefused(state, actor, guildId, fn) ??
        row.reasonClosed(state, actor) ??
        row.reasonRefused(state, actor, params)
    )
}

export interface GuildActionOffer {
    readonly guildId: GuildId
    readonly fn: GuildFunctionName
    /** R-3.16.1 Set when the function is dimmed. */
    readonly reason?: string
    /** R-4.6.1 The most it can score now, for "up to". */
    readonly bestVp: number
}

/** R-3.16.1, R-3.16.2 Each function of each guild the seat has not used this round. */
export function guildActionOffers(
    state: HydratedFeudumGameState,
    playerId: string
): GuildActionOffer[] {
    const actor = { playerId }
    return GuildIds.filter((guildId) => !reasonGuildUsedRefused(state, playerId, guildId)).flatMap(
        (guildId) =>
            GuildFunctionNames.map((fn): GuildActionOffer => {
                const row = guildFunctionRow(guildId, fn)
                const reason =
                    reasonRankRefused(state, actor, guildId, fn) ?? row.reasonClosed(state, actor)
                const bestVp = pointsFor(fn, row.bestCompletions?.(state, actor) ?? 0)
                return { guildId, fn, bestVp, ...(reason ? { reason } : {}) }
            })
    )
}

export type GuildActionPreview = GuildFunctionPreview & {
    readonly refused?: string
}

/** R-4.6, R-4.7 Points, completions, the split, reeve points and whether the send sets `revealsInfo`. */
export function guildActionPreview(
    state: HydratedFeudumGameState,
    playerId: string,
    input: GuildActionInput
): GuildActionPreview | undefined {
    const { guildId, fn, params } = input
    const row = guildFunctionRow(guildId, fn)
    const preview = guildFunctionPreview(state, { playerId }, guildId, fn, row, params)
    if (!preview) {
        return undefined
    }
    const refused = reasonGuildActionRefused(state, playerId, input)
    return refused ? { ...preview, refused } : preview
}

export class HydratedGuildAction
    extends HydratableAction<typeof GuildAction>
    implements GuildAction
{
    declare type: ActionType.GuildAction
    declare playerId: string
    declare metadata?: GuildActionMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true
    declare guildId: GuildId
    declare fn: GuildFunctionName
    declare params: GuildFunctionParams

    constructor(data: GuildAction) {
        super(data, GuildActionValidator)
    }

    /** R-3.16, R-4.6, R-4.7 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonGuildActionRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        playCard(state, this.playerId, 'guild', 'regular', this)
        markGuildUsed(state, this.playerId, this.guildId)
        const { outcome, revealsInfo } = performGuildFunction(
            state,
            { playerId: this.playerId },
            this.guildId,
            this.fn,
            guildFunctionRow(this.guildId, this.fn),
            this.params
        )
        this.metadata = outcome
        if (revealsInfo) {
            markRevealsInfo(this, true)
        }
    }
}
