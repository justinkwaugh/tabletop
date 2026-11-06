import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import type { GuildId } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { atWillWindow } from '../model/atWill.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import { canSpendWildTiles, payGoods, WildTileSpend } from '../model/payments.js'
import { PawnNumberSchema } from '../model/stateSchemas.js'
import { barrelRoom } from '../model/supply.js'
import { leaveBoard, PawnLeft, type PawnNumber } from './migrate.js'

export type NourishMetadata = Type.Static<typeof NourishMetadata>
export const NourishMetadata = Type.Object({
    /** R-4.10.1 The pawns the rest of the food fed; the input names the others. */
    foodFed: Type.Array(PawnNumberSchema),
    /** R-4.10.1 Each unfed pawn, where it stood and what it was. */
    returned: Type.Array(Type.Object({ n: PawnNumberSchema, left: PawnLeft })),
    /** R-4.5.2 A pawn leaving moves its stars. */
    rankChanges: Type.Array(RankChange)
})

export type Nourish = Type.Static<typeof Nourish>
export const Nourish = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Nourish),
            playerId: Type.String(),
            /** R-4.10.2 Each takes a barrel sulfur. */
            wineFed: Type.Array(PawnNumberSchema),
            /** R-4.10.1, R-4.10-H3 Each goes to supply. Every other pawn eats a food. */
            unfed: Type.Array(PawnNumberSchema),
            /** R-4.3.3 Tiles spent first, each for a good; a sulfur may go to the barrel. */
            wildTiles: Type.Optional(Type.Array(WildTileSpend)),
            metadata: Type.Optional(NourishMetadata)
        })
    ])
)

export const NourishValidator = Compile(Nourish)

export function isNourish(action?: GameAction): action is Nourish {
    return action?.type === ActionType.Nourish
}

export interface NourishInput {
    readonly wineFed: readonly PawnNumber[]
    readonly unfed: readonly PawnNumber[]
    readonly wildTiles?: readonly WildTileSpend[]
}

/** R-4.10.1, R-4.10.2 The pawns on the board that need feeding: a pawn holding sulfur is fed by it. */
function pawnsToFeed(state: HydratedFeudumGameState, playerId: string) {
    return state
        .getPlayerState(playerId)
        .pawns.filter((pawn) => pawn.spaceId !== undefined && pawn.wine === undefined)
}

/** R-4.3.3 What the seat has to feed with once the tiles are spent. */
function feedAfterTiles(
    state: HydratedFeudumGameState,
    playerId: string,
    wildTiles: readonly WildTileSpend[]
): { readonly food: number; readonly barrel: number } {
    const { goods, barrel } = state.getPlayerState(playerId)
    return {
        food: goods.food + wildTiles.filter((spend) => spend.good === 'food').length,
        barrel: barrel + wildTiles.filter((spend) => spend.sulfurToBarrel).length
    }
}

/**
 * R-4.10.1, R-4.10.2, R-4.10-H3 The seat asked names only pawns needing food, and feeds every pawn
 * its food and barrel can after any tiles.
 */
export function reasonNourishRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    { wineFed, unfed, wildTiles = [] }: NourishInput
): string | undefined {
    if (atWillWindow(state, playerId) !== 'nourishing') {
        return "It isn't your turn to nourish."
    }
    const named = [...wineFed, ...unfed]
    if (new Set(named).size !== named.length) {
        return 'Name each pawn once.'
    }
    const needing = pawnsToFeed(state, playerId).map((pawn) => pawn.n)
    if (named.some((n) => !needing.includes(n))) {
        return 'That pawn needs no feeding.'
    }
    if (!canSpendWildTiles(state, playerId, wildTiles)) {
        return "You can't spend those region tiles."
    }
    const { food, barrel } = feedAfterTiles(state, playerId, wildTiles)
    if (wineFed.length > barrel) {
        return `Your barrel holds ${barrel} sulfur.`
    }
    const byFood = needing.length - named.length
    if (byFood > food) {
        return `That takes ${byFood} food; you have ${food}.`
    }
    return unfed.length > Math.max(needing.length - food - barrel, 0)
        ? 'You must feed every pawn you have food or wine for.'
        : undefined
}

/** R-4.3.3 A tile could bring food or a barrel sulfur. */
function tileCouldFeed(state: HydratedFeudumGameState, playerId: string): boolean {
    const { food, sulfur } = state.supply.haversack
    return (
        state.getPlayerState(playerId).regionTiles.length > 0 &&
        (food > 0 || (sulfur > 0 && barrelRoom(state, playerId) > 0))
    )
}

/**
 * D11 Whether this seat has anything to decide: food or wine, a wild tile while short, or which pawn
 * goes unfed. A seat with nothing to decide is fed by the game.
 */
export function nourishHasChoice(state: HydratedFeudumGameState, playerId: string): boolean {
    const { goods, barrel } = state.getPlayerState(playerId)
    const needing = pawnsToFeed(state, playerId).length
    const short = needing - goods.food - barrel
    return (
        needing > 0 &&
        ((goods.food > 0 && barrel > 0) ||
            (short > 0 && (short < needing || tileCouldFeed(state, playerId))))
    )
}

/** R-4.10.1 One pawn the seat decides for. */
export interface NourishPawnOffer {
    readonly n: PawnNumber
    readonly spaceId: SpaceId
    readonly character: GuildId
}

export interface NourishOffer {
    /** R-4.10.1, R-4.10.2 Pawns needing feeding; a pawn holding sulfur is fed by it. */
    readonly pawns: readonly NourishPawnOffer[]
    readonly food: number
    readonly barrel: number
    /** R-4.10.1 The auto stage: food first in pawn order, then wine, then unfed. */
    readonly preselected: { readonly wineFed: PawnNumber[]; readonly unfed: PawnNumber[] }
    /** R-4.3.3 Food and wine fall short and a tile could bring one. */
    readonly wildTileNeeded: boolean
    /** R-4.10.2, R-4.10-H1 A tile's sulfur could go straight into the barrel. */
    readonly sulfurToBarrel: boolean
}

/** R-4.10, D11 What the asked seat decides. Read-only. */
export function nourishOffer(
    state: HydratedFeudumGameState,
    playerId: string
): NourishOffer | undefined {
    if (atWillWindow(state, playerId) !== 'nourishing') {
        return undefined
    }
    const { goods, barrel } = state.getPlayerState(playerId)
    const pawns = pawnsToFeed(state, playerId).map(({ n, spaceId, character }) => {
        assertExists(spaceId, 'R-4.10.1 The pawn is on the board')
        assertExists(character, 'R-1.1 A pawn on the board shows a character')
        return { n, spaceId, character }
    })
    const afterFood = pawns.slice(goods.food).map((pawn) => pawn.n)
    return {
        pawns,
        food: goods.food,
        barrel,
        preselected: { wineFed: afterFood.slice(0, barrel), unfed: afterFood.slice(barrel) },
        wildTileNeeded: afterFood.length > barrel && tileCouldFeed(state, playerId),
        sulfurToBarrel: state.supply.haversack.sulfur > 0 && barrelRoom(state, playerId) > 0
    }
}

/** R-4.10.1 Tiles first, then food to the haversack, sulfur on the pawns, the unfed home. */
function feedPawns(
    state: HydratedFeudumGameState,
    playerId: string,
    { wineFed, unfed, wildTiles = [] }: NourishInput
): NourishMetadata {
    const needing = pawnsToFeed(state, playerId)
    const foodFed = needing
        .map((pawn) => pawn.n)
        .filter((n) => !wineFed.includes(n) && !unfed.includes(n))
    payGoods(state, playerId, { food: foodFed.length }, wildTiles)

    const player = state.getPlayerState(playerId)
    for (const pawn of needing.filter(({ n }) => wineFed.includes(n))) {
        player.barrel -= 1
        pawn.wine = 'fed'
    }
    const returned = unfed.map((n) => ({ n, left: leaveBoard(state, playerId, n) }))
    return { foodFed, returned, rankChanges: state.recomputeRanks(playerId) }
}

export interface NourishPreview {
    readonly food: number
    readonly wine: number
    readonly unfed: number
    /** R-4.5.2 Only once the input is legal. */
    readonly rankChanges: readonly RankChange[]
    readonly refused?: string
}

/** R-4.10.1 What the staged choice comes to, run on a copy; `refused` until it is legal. */
export function nourishPreview(
    state: HydratedFeudumGameState,
    playerId: string,
    input: NourishInput
): NourishPreview {
    const counts = {
        food: Math.max(
            0,
            pawnsToFeed(state, playerId).length - input.wineFed.length - input.unfed.length
        ),
        wine: input.wineFed.length,
        unfed: input.unfed.length
    }
    const refused = reasonNourishRefused(state, playerId, input)
    if (refused) {
        return { ...counts, rankChanges: [], refused }
    }
    const { rankChanges } = feedPawns(
        new HydratedFeudumGameState(state.dehydrate()),
        playerId,
        input
    )
    return { ...counts, rankChanges }
}

export class HydratedNourish extends HydratableAction<typeof Nourish> implements Nourish {
    declare type: ActionType.Nourish
    declare playerId: string
    declare wineFed: PawnNumber[]
    declare unfed: PawnNumber[]
    declare wildTiles?: WildTileSpend[]
    declare metadata?: NourishMetadata

    constructor(data: Nourish) {
        super(data, NourishValidator)
    }

    /** R-4.10, D11 Everything is public: never a barrier. Then the next seat is asked. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonNourishRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        this.metadata = feedPawns(state, this.playerId, this)

        const { nourish } = state.flow
        assertExists(nourish, 'R-4.10 The seats are being asked')
        nourish.pending.shift()
        if (nourish.pending.length === 0) {
            state.flow.nourish = undefined
        }
    }
}
