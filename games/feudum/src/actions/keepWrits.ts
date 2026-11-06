import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility
} from '@tabletop/common'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import type { WritDrawSource } from '../model/flow.js'
import { drawWritsToKeep, finishFollowUp, requireDrawnWrits } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { KnownDeckWrit } from '../model/playerState.js'
import { ComponentCount, WritIdSchema } from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import { putWritsUnderUnseen, writDeckCount } from '../model/writDeck.js'
import { reasonSpecialRefused } from './cardPlay.js'

/** R-3.10.2 */
const ShovelsDraw = 2
/** R-3.10.2 */
const ShovelsKeep = 1

export type KeepWritsMetadata = Type.Static<typeof KeepWritsMetadata>
export const KeepWritsMetadata = Type.Object({
    /** R-4.4.1 The table learns how many; only the actor which. */
    keptCount: ComponentCount,
    returnedCount: ComponentCount,
    /** R-4.4.1, R-4.4-H3 Actor-known, in the order drawn, each with the slot it took. */
    returned: Visibility.protect(Type.Array(KnownDeckWrit), { policy: Visibility.Policy.Actor }),
    /** R-3.10.2 Shovels & Swords: how many it drew and how many are then to keep. */
    drawnCount: Type.Optional(ComponentCount),
    keepNext: Type.Optional(ComponentCount),
    /** R-3.10.2 Actor-known. */
    drawnWritIds: Visibility.protect(Type.Optional(Type.Array(WritIdSchema)), {
        policy: Visibility.Policy.Actor
    })
})

export type KeepWrits = Type.Static<typeof KeepWrits>
export const KeepWrits = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.KeepWrits),
            playerId: Type.String(),
            metadata: Type.Optional(KeepWritsMetadata),
            /** R-4.4.1 Actor-known. */
            keep: Visibility.protect(Type.Array(WritIdSchema), {
                policy: Visibility.Policy.Actor
            }),
            /** R-3.10.2, R-3.10-H2 Decided at the keep, after seeing the first draw. */
            shovelsAndSwords: Type.Optional(Type.Literal(true))
        })
    ])
)

export const KeepWritsValidator = Compile(KeepWrits)

export function isKeepWrits(action?: GameAction): action is KeepWrits {
    return action?.type === ActionType.KeepWrits
}

/** R-4.4.1 The draw waiting on this seat, if any. */
function drawOf(state: HydratedFeudumGameState, playerId: string) {
    const { writDraw } = state.flow
    return writDraw?.playerId === playerId ? writDraw : undefined
}

/**
 * R-3.10.2, R-3.10-H2, R-3.10-H3 After the keep from an Explore draw, once, for an iron, with a
 * writ to draw. The writs not kept go under first, so they count as there to draw.
 */
function reasonShovelsRefused(
    state: HydratedFeudumGameState,
    playerId: string
): string | undefined {
    const writDraw = drawOf(state, playerId)
    if (!writDraw?.shovelsOffered) {
        return 'Shovels & Swords follows only the keep from an Explore draw.'
    }
    const afterKeep = writDeckCount(state) + writDraw.drawnCount - writDraw.keep
    return (
        reasonSpecialRefused(state, playerId, 'explore') ??
        (afterKeep > 0 ? undefined : 'The deck has no writs left to draw.')
    )
}

/** R-4.4.1, R-4.4-H2 The stated number, all of them from this draw. */
export function reasonKeepWritsRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    {
        keep,
        shovelsAndSwords
    }: { readonly keep: readonly WritId[]; readonly shovelsAndSwords?: true }
): string | undefined {
    const writDraw = drawOf(state, playerId)
    if (!writDraw) {
        return 'No writ draw waits on you.'
    }
    if (keep.length !== writDraw.keep) {
        return `Keep ${writDraw.keep} writ${writDraw.keep === 1 ? '' : 's'}, not ${keep.length}.`
    }
    const drawn = requireDrawnWrits(writDraw)
    if (new Set(keep).size !== keep.length || keep.some((writId) => !drawn.includes(writId))) {
        return 'Keep only writs you drew.'
    }
    return shovelsAndSwords ? reasonShovelsRefused(state, playerId) : undefined
}

export interface ShovelsOffer {
    readonly draw: number
    readonly keep: number
    /** R-X.2 A second draw can't be undone. */
    readonly revealsInfo: true
}

export interface KeepWritsOffer {
    readonly drawn: readonly WritId[]
    readonly keep: number
    readonly source: WritDrawSource
    /** R-3.10.2 Absent when it can't be taken. */
    readonly shovelsAndSwords?: ShovelsOffer
}

/** R-4.4.1, R-3.10.2 What the drawer is deciding. */
export function keepWritsOffer(
    state: HydratedFeudumGameState,
    playerId: string
): KeepWritsOffer | undefined {
    const writDraw = drawOf(state, playerId)
    if (!writDraw) {
        return undefined
    }
    const shovelsAndSwords: ShovelsOffer = {
        draw: ShovelsDraw,
        keep: ShovelsKeep,
        revealsInfo: true
    }
    return {
        drawn: requireDrawnWrits(writDraw),
        keep: writDraw.keep,
        source: writDraw.source,
        ...(reasonShovelsRefused(state, playerId) ? {} : { shovelsAndSwords })
    }
}

export class HydratedKeepWrits extends HydratableAction<typeof KeepWrits> implements KeepWrits {
    declare type: ActionType.KeepWrits
    declare playerId: string
    declare metadata?: KeepWritsMetadata
    declare keep: WritId[]
    declare shovelsAndSwords?: true

    constructor(data: KeepWrits) {
        super(data, KeepWritsValidator)
    }

    /** R-4.4.1, R-4.4-H3 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonKeepWritsRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const returned = this.keepFromDraw(state)
        const kept = { keptCount: this.keep.length, returnedCount: returned.length, returned }
        this.metadata = this.shovelsAndSwords ? { ...kept, ...this.turnInForShovels(state) } : kept
    }

    /** R-4.4.1, R-4.4-H3 The keep ends this draw; the rest go under in the order drawn. */
    private keepFromDraw(state: HydratedFeudumGameState): KnownDeckWrit[] {
        const { writDraw } = state.flow
        assertExists(writDraw, 'R-4.4.1 The reason has found the draw')
        const player = state.getPlayerState(this.playerId)
        const writs = player.requireWrits()
        writs.push(...this.keep)
        player.writCount = writs.length

        const known = player.requireDeckKnowledge().length
        putWritsUnderUnseen(
            state,
            this.playerId,
            requireDrawnWrits(writDraw).filter((writId) => !this.keep.includes(writId))
        )
        state.flow.writDraw = undefined
        finishFollowUp(state)
        return player.requireDeckKnowledge().slice(known)
    }

    /** R-3.10.2 The Explore just played becomes its special; the barrier is the second draw. */
    private turnInForShovels(
        state: HydratedFeudumGameState
    ): Pick<KeepWritsMetadata, 'drawnCount' | 'keepNext' | 'drawnWritIds'> {
        const player = state.getPlayerState(this.playerId)
        const played = player.played.at(-1)
        assert(
            played && (played.kind === 'explore' || played.replayedKind === 'explore'),
            'R-3.10.2 Shovels & Swords belongs to the Explore being played'
        )
        played.use = 'special'
        player.goods.iron -= 1
        returnGoodToHaversack(state, 'iron')

        const drawnCount = drawWritsToKeep(
            state,
            this.playerId,
            { draw: ShovelsDraw, keep: ShovelsKeep },
            'shovels'
        )
        const { writDraw } = state.flow
        assertExists(writDraw, 'R-3.10-H3 The reason has found a writ to draw')
        this.revealsInfo = true
        return {
            drawnCount,
            keepNext: writDraw.keep,
            drawnWritIds: [...requireDrawnWrits(writDraw)]
        }
    }
}
