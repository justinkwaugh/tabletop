import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Spaces, type SpaceId } from '../data/board.js'
import { GuildById } from '../data/guilds.js'
import type { GuildId } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { markRevealsInfo } from '../definition/revealing.js'
import {
    GuildFunctionOutcome,
    GuildFunctionParams,
    GuildFunctionSchema,
    markGuildUsed,
    pointsFor,
    reasonGuildUsedRefused,
    type FunctionActor,
    type GuildFunctionName
} from '../guilds/guildFunction.js'
import {
    guildFunctionPreview,
    guildFunctionRow,
    performGuildFunction,
    type GuildFunctionPreview
} from '../guilds/registry.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { rankOf } from '../model/guildStatus.js'
import { feudumGuildOf } from '../model/locationDiscs.js'
import { GuildIdSchema, SpaceIdSchema } from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import {
    CardPlayFields,
    cardOf,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

export type FeastMetadata = Type.Static<typeof FeastMetadata>
export const FeastMetadata = Type.Evaluate(
    Type.Intersect([
        GuildFunctionOutcome,
        Type.Object({
            /** R-3.16.3 The opponent's own function, from their rank. */
            fn: GuildFunctionSchema,
            /** R-3.16.3, R-3.16-H2 */
            feastPoints: Type.Integer({ minimum: 0 })
        })
    ])
)

export type Feast = Type.Static<typeof Feast>
export const Feast = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Feast),
            playerId: Type.String(),
            metadata: Type.Optional(FeastMetadata),
            /** R-3.16.3 Where the seat's pawn stands with the opponent's piece. */
            spaceId: SpaceIdSchema,
            opponentId: Type.String(),
            guildId: GuildIdSchema,
            params: GuildFunctionParams
        })
    ])
)

export const FeastValidator = Compile(Feast)

export function isFeast(action?: GameAction): action is Feast {
    return action?.type === ActionType.Feast
}

export interface FeastInput extends CardPlayInput {
    readonly spaceId: SpaceId
    readonly opponentId: string
    readonly guildId: GuildId
    readonly params: GuildFunctionParams
}

/** R-3.16.3, R-3.16-H2 The card's printed vp, whatever the function reached. */
function feastPoints(): number {
    return cardOf('guild').special.vp ?? 0
}

/** R-3.16.3 Their own function: the push if they are master, the pull if journeyman. */
export function feastFunction(
    state: HydratedFeudumGameState,
    opponentId: string,
    guildId: GuildId
): GuildFunctionName | undefined {
    switch (rankOf(state.guilds.tracks[guildId], opponentId)) {
        case 'master': {
            return 'push'
        }
        case 'journeyman': {
            return 'pull'
        }
        default: {
            return undefined
        }
    }
}

/** R-3.16.3 The guilds a seat's pieces on this space relate to: its pawns' and its feudum's. */
function guildsOfPieces(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId
): GuildId[] {
    const pawns = state.players.find((player) => player.playerId === playerId)?.pawns ?? []
    const { location, ruler } = state.spaces[spaceId]
    const feudum = ruler?.playerId === playerId ? feudumGuildOf(location) : undefined
    return [
        ...new Set([
            ...pawns.flatMap((pawn) =>
                pawn.spaceId === spaceId && pawn.character ? [pawn.character] : []
            ),
            ...(feudum ? [feudum] : [])
        ])
    ]
}

/** R-3.16.3, R-4.2.4, R-4.2-H1 A pin stops only steps, so a pinned pawn may feast. */
function reasonPawnRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId
): string | undefined {
    return state.getPlayerState(playerId).pawns.some((pawn) => pawn.spaceId === spaceId)
        ? undefined
        : 'You have no pawn there.'
}

/** R-3.16.3 Never for the seat's own pieces; the opponent's piece relates to the guild. */
function reasonOpponentRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    { spaceId, opponentId, guildId }: FeastInput
): string | undefined {
    if (opponentId === playerId) {
        return "You can't feast on your own pieces."
    }
    const { name } = GuildById[guildId]
    if (!guildsOfPieces(state, opponentId, spaceId).includes(guildId)) {
        return `That seat has no ${name} pawn or feudum there.`
    }
    return feastFunction(state, opponentId, guildId)
        ? undefined
        : `That seat is neither master nor journeyman of the ${name} Guild.`
}

/** R-3.16.1, R-3.16.2, R-3.16.3, R-4.6.1 */
export function reasonFeastRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: FeastInput
): string | undefined {
    const { spaceId, opponentId, guildId, params } = input
    const refused =
        reasonCardPlayRefused(state, playerId, 'guild', input) ??
        reasonSpecialRefused(state, playerId, 'guild', spaceId) ??
        reasonPawnRefused(state, playerId, spaceId) ??
        reasonOpponentRefused(state, playerId, input) ??
        reasonGuildUsedRefused(state, playerId, guildId)
    const fn = feastFunction(state, opponentId, guildId)
    if (refused || !fn) {
        return refused
    }
    const row = guildFunctionRow(guildId, fn)
    const actor: FunctionActor = { playerId, feastOf: opponentId }
    return row.reasonClosed(state, actor) ?? row.reasonRefused(state, actor, params)
}

export interface FeastOffer {
    readonly spaceId: SpaceId
    readonly opponentId: string
    readonly guildId: GuildId
    readonly fn: GuildFunctionName
    /** R-3.16.1 Set when the function is dimmed. */
    readonly reason?: string
    /** R-4.6.1, R-3.16.3 The most it can score now, the feast's vp included. */
    readonly bestVp: number
}

/** R-3.16.2, R-3.16.3 One per space, opponent and guild, however many pieces stand there. */
export function feastOffers(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CardPlayInput = {}
): FeastOffer[] {
    if (
        reasonCardPlayRefused(state, playerId, 'guild', input) ??
        reasonSpecialRefused(state, playerId, 'guild')
    ) {
        return []
    }
    const opponents = state.players.filter((player) => player.playerId !== playerId)
    return Spaces.filter(({ id }) => !reasonPawnRefused(state, playerId, id)).flatMap(
        ({ id: spaceId }) =>
            opponents.flatMap(({ playerId: opponentId }) =>
                guildsOfPieces(state, opponentId, spaceId).flatMap((guildId): FeastOffer[] => {
                    const fn = feastFunction(state, opponentId, guildId)
                    if (!fn || reasonGuildUsedRefused(state, playerId, guildId)) {
                        return []
                    }
                    const row = guildFunctionRow(guildId, fn)
                    const actor = { playerId, feastOf: opponentId }
                    const reason = row.reasonClosed(state, actor)
                    const best = pointsFor(fn, row.bestCompletions?.(state, actor) ?? 0)
                    return [
                        {
                            spaceId,
                            opponentId,
                            guildId,
                            fn,
                            bestVp: best + feastPoints(),
                            ...(reason ? { reason } : {})
                        }
                    ]
                })
            )
    )
}

export type FeastPreview = GuildFunctionPreview & {
    readonly fn: GuildFunctionName
    /** R-3.16.3, R-3.16-H2 Added to the function's `points`. */
    readonly feastPoints: number
    /** Set while the staged input would still be refused. */
    readonly refused?: string
}

/** R-3.16.3, R-4.6 As the Guild action's preview, with no reeve, and the feast's vp. */
export function feastPreview(
    state: HydratedFeudumGameState,
    playerId: string,
    input: FeastInput
): FeastPreview | undefined {
    const { opponentId, guildId, params } = input
    const fn = feastFunction(state, opponentId, guildId)
    if (!fn) {
        return undefined
    }
    const preview = guildFunctionPreview(
        state,
        { playerId, feastOf: opponentId },
        guildId,
        fn,
        guildFunctionRow(guildId, fn),
        params
    )
    if (!preview) {
        return undefined
    }
    const refused = reasonFeastRefused(state, playerId, input)
    return { ...preview, fn, feastPoints: feastPoints(), ...(refused ? { refused } : {}) }
}

export class HydratedFeast extends HydratableAction<typeof Feast> implements Feast {
    declare type: ActionType.Feast
    declare playerId: string
    declare metadata?: FeastMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true
    declare spaceId: SpaceId
    declare opponentId: string
    declare guildId: GuildId
    declare params: GuildFunctionParams

    constructor(data: Feast) {
        super(data, FeastValidator)
    }

    /** R-3.16.2, R-3.16.3, R-3.16-H1, R-3.16-H2 No reeve scores. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonFeastRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const fn = feastFunction(state, this.opponentId, this.guildId)
        if (!fn) {
            throw Error('That seat has no function to feast on.')
        }
        playCard(state, this.playerId, 'guild', 'special', this)
        markGuildUsed(state, this.playerId, this.guildId)
        const player = state.getPlayerState(this.playerId)
        player.barrel -= 1
        returnGoodToHaversack(state, 'sulfur')
        const { outcome, revealsInfo } = performGuildFunction(
            state,
            { playerId: this.playerId, feastOf: this.opponentId },
            this.guildId,
            fn,
            guildFunctionRow(this.guildId, fn),
            this.params
        )
        player.score += feastPoints()
        this.metadata = { ...outcome, fn, feastPoints: feastPoints() }
        if (revealsInfo) {
            markRevealsInfo(this, true)
        }
    }
}
