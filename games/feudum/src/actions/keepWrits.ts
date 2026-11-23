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
import { markRevealsInfo } from '../definition/revealing.js'
import type { WritDrawSource } from '../model/flow.js'
import { drawWritsToKeep, finishFollowUp, requireDrawnWrits } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    canCoverWithWildTiles,
    canPayGoods,
    canSpendWildTiles,
    goodsShort,
    payGoods,
    WildTileSpend
} from '../model/payments.js'
import { KnownDeckWrit } from '../model/playerState.js'
import { ComponentCount, WritIdSchema } from '../model/stateSchemas.js'
import { cardTurnSeat } from '../model/turns.js'
import { putWritsUnderUnseen, writDeckCount } from '../model/writDeck.js'
import { reasonSpecialRefused } from './cardPlay.js'
import { plural } from '../model/words.js'

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
            shovelsAndSwords: Type.Optional(Type.Literal(true)),
            /** R-4.3-H3 No window comes before this payment, so it takes its own tiles. */
            wildTiles: Type.Optional(Type.Array(WildTileSpend))
        })
    ])
)

export const KeepWritsValidator = Compile(KeepWrits)

export function isKeepWrits(action?: GameAction): action is KeepWrits {
    return action?.type === ActionType.KeepWrits
}

/** R-3.10.2 */
const ShovelsPrice = { iron: 1 }

/** R-4.4.1 The draw waiting on this seat, if any: the turn seat's. */
function drawOf(state: HydratedFeudumGameState, playerId: string) {
    return cardTurnSeat(state) === playerId ? state.flow.writDraw : undefined
}

/** R-3.10.2, R-3.10-H2, R-3.10-H3 The unkept go under first, so they count as there to draw. */
function reasonShovelsRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    wildTiles: readonly WildTileSpend[] = []
): string | undefined {
    const writDraw = drawOf(state, playerId)
    if (!writDraw?.shovelsOffered) {
        return 'Shovels & Swords follows only the keep from an Explore draw.'
    }
    if (!canSpendWildTiles(state, playerId, wildTiles)) {
        return "You can't spend those region tiles."
    }
    const afterKeep = writDeckCount(state) + writDraw.drawnCount - writDraw.keep
    const paid = canPayGoods(state, playerId, ShovelsPrice, wildTiles)
    return (
        (paid ? undefined : reasonSpecialRefused(state, playerId, 'explore')) ??
        (afterKeep > 0 ? undefined : 'The deck has no writs left to draw.')
    )
}

/** R-4.4.1, R-4.4-H2 The stated number, all of them from this draw. */
export function reasonKeepWritsRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    {
        keep,
        shovelsAndSwords,
        wildTiles
    }: {
        readonly keep: readonly WritId[]
        readonly shovelsAndSwords?: true
        readonly wildTiles?: readonly WildTileSpend[]
    }
): string | undefined {
    const writDraw = drawOf(state, playerId)
    if (!writDraw) {
        return 'No writ draw waits on you.'
    }
    if (keep.length !== writDraw.keep) {
        return `Keep ${plural(writDraw.keep, 'writ')}, not ${keep.length}.`
    }
    const drawn = requireDrawnWrits(state)
    if (new Set(keep).size !== keep.length || keep.some((writId) => !drawn.includes(writId))) {
        return 'Keep only writs you drew.'
    }
    if (wildTiles && !shovelsAndSwords) {
        return 'Only Shovels & Swords takes a tile here.'
    }
    return shovelsAndSwords ? reasonShovelsRefused(state, playerId, wildTiles) : undefined
}

export interface ShovelsOffer {
    readonly draw: number
    readonly keep: number
    /** R-X.2 A second draw can't be undone. */
    readonly revealsInfo: true
    /** R-4.3-H3 The seat holds no iron and a tile can bring one. */
    readonly wildTileNeeded: boolean
}

export interface KeepWritsOffer {
    readonly drawn: readonly WritId[]
    readonly keep: number
    readonly source: WritDrawSource
    /** R-3.10.2 Absent when it can't be taken. */
    readonly shovelsAndSwords?: ShovelsOffer
}

/** R-4.4.1, R-3.10.2 */
export function keepWritsOffer(
    state: HydratedFeudumGameState,
    playerId: string
): KeepWritsOffer | undefined {
    const writDraw = drawOf(state, playerId)
    if (!writDraw) {
        return undefined
    }
    const wildTileNeeded =
        goodsShort(state, playerId, ShovelsPrice).iron > 0 &&
        canCoverWithWildTiles(state, playerId, ShovelsPrice)
    const anyTile = state
        .getPlayerState(playerId)
        .regionTiles.slice(0, 1)
        .map((tileId): WildTileSpend => ({ tileId, good: 'iron' }))
    const shovelsAndSwords: ShovelsOffer = {
        draw: ShovelsDraw,
        keep: ShovelsKeep,
        revealsInfo: true,
        wildTileNeeded
    }
    return {
        drawn: requireDrawnWrits(state),
        keep: writDraw.keep,
        source: writDraw.source,
        ...(reasonShovelsRefused(state, playerId, wildTileNeeded ? anyTile : [])
            ? {}
            : { shovelsAndSwords })
    }
}

export class HydratedKeepWrits extends HydratableAction<typeof KeepWrits> implements KeepWrits {
    declare type: ActionType.KeepWrits
    declare playerId: string
    declare metadata?: KeepWritsMetadata
    declare keep: WritId[]
    declare shovelsAndSwords?: true
    declare wildTiles?: WildTileSpend[]

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
        const player = state.getPlayerState(this.playerId)
        const writs = player.requireWrits()
        writs.push(...this.keep)
        player.writCount = writs.length + player.sealedCharterCount

        const known = player.requireDeckKnowledge().length
        putWritsUnderUnseen(
            state,
            this.playerId,
            requireDrawnWrits(state).filter((writId) => !this.keep.includes(writId))
        )
        delete player.writsDrawn
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
        payGoods(state, this.playerId, ShovelsPrice, this.wildTiles ?? [])

        const drawnCount = drawWritsToKeep(
            state,
            { draw: ShovelsDraw, keep: ShovelsKeep },
            'shovels'
        )
        const { writDraw } = state.flow
        assertExists(writDraw, 'R-3.10-H3 The reason has found a writ to draw')
        markRevealsInfo(this, true)
        return {
            drawnCount,
            keepNext: writDraw.keep,
            drawnWritIds: [...requireDrawnWrits(state)]
        }
    }
}
