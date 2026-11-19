import {
    Goods,
    MonsterIds,
    VesselTypes,
    type Character,
    type Good,
    type GoodCounts,
    type HydratedFeudumGameState,
    type MonsterId,
    type PawnNumber,
    type SpaceId,
    type VesselCounts,
    type VesselType
} from '@tabletop/feudum'
import { GoodsShownSingly, PieceSlotCount } from '$lib/utils/boardGeometry.js'

/** One kind of good on a space: `tokens` tokens, and a count on them past the fourth. */
export interface GoodStack {
    readonly good: Good
    readonly tokens: number
    readonly count?: number
}

/** R-1.1 In the barn, one token per good up to four, then one token with a count. */
export function goodStacks(goods: Readonly<GoodCounts>): readonly GoodStack[] {
    return Goods.filter((good) => goods[good] > 0).map((good) =>
        goods[good] <= GoodsShownSingly
            ? { good, tokens: goods[good] }
            : { good, tokens: 1, count: goods[good] }
    )
}

export interface GoodKind {
    readonly good: Good
    readonly count: number
}

/** R-1.1 The goods on a space by kind, each with how many lie there. */
export function goodKinds(goods: Readonly<GoodCounts>): readonly GoodKind[] {
    return Goods.filter((good) => goods[good] > 0).map((good) => ({ good, count: goods[good] }))
}

export interface AbandonedVessels {
    readonly vessel: VesselType
    readonly count: number
}

/** R-4.2.2 Abandoned vessels lying on a space. */
export function abandonedVessels(vessels: Readonly<VesselCounts>): readonly AbandonedVessels[] {
    return VesselTypes.filter((vessel) => vessels[vessel] > 0).map((vessel) => ({
        vessel,
        count: vessels[vessel]
    }))
}

export type MapPiece =
    | {
          readonly kind: 'pawn'
          readonly playerId: string
          readonly n: PawnNumber
          readonly character: Character
          readonly vessel?: VesselType
          readonly drunk: boolean
      }
    | { readonly kind: 'monster'; readonly monster: MonsterId; readonly playerId?: string }

/** The motion key of a piece: a pawn is (playerId, n) (R-1.1), a monster its id. */
export function pieceKey(piece: MapPiece): string {
    return piece.kind === 'pawn' ? `pawn:${piece.playerId}:${piece.n}` : `monster:${piece.monster}`
}

/** R-4.1 A space's pawns in seat order, then its monsters, each in a stable place. */
export function piecesOn(state: HydratedFeudumGameState, spaceId: SpaceId): readonly MapPiece[] {
    const pawns = state.players.flatMap((player) =>
        player.pawns.flatMap((pawn): MapPiece[] =>
            pawn.spaceId === spaceId && pawn.character
                ? [
                      {
                          kind: 'pawn',
                          playerId: player.playerId,
                          n: pawn.n,
                          character: pawn.character,
                          ...(pawn.vessel ? { vessel: pawn.vessel } : {}),
                          drunk: pawn.wine === 'drunk'
                      }
                  ]
                : []
        )
    )
    const monsters = MonsterIds.flatMap((monster): MapPiece[] => {
        const { spaceId: at, playerId } = state.monsters[monster]
        return at === spaceId
            ? [{ kind: 'monster', monster, ...(playerId ? { playerId } : {}) }]
            : []
    })
    return [...pawns, ...monsters]
}

/** Up to four pieces sit round a space; the rest are a count on a chip. */
export function slottedPieces(pieces: readonly MapPiece[]): {
    readonly shown: readonly MapPiece[]
    readonly more: number
} {
    return {
        shown: pieces.slice(0, PieceSlotCount),
        more: Math.max(0, pieces.length - PieceSlotCount)
    }
}
