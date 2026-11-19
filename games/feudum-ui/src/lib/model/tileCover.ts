import {
    Goods,
    type Good,
    type GoodCounts,
    type HydratedFeudumGameState,
    type TileId,
    type WildTileSpend
} from '@tabletop/feudum'

/** R-4.4-H1 One entry per good a payment is short of: each takes one tile. */
export function coverNeeds(short: Readonly<GoodCounts>): readonly Good[] {
    return Goods.flatMap((good) => Array.from({ length: short[good] }, () => good))
}

/** R-4.4-H1 The list after a press: a picked tile comes off, another goes on while one is owed. */
export function coverAfterPress(
    picked: readonly TileId[],
    tileId: TileId,
    needs: readonly Good[]
): readonly TileId[] | undefined {
    if (picked.includes(tileId)) {
        return picked.filter((id) => id !== tileId)
    }
    return picked.length < needs.length ? [...picked, tileId] : undefined
}

/** Holding exactly as many tiles as goods owed, the whole list is the lone choice. */
export function loneCover(
    state: HydratedFeudumGameState,
    playerId: string,
    needs: readonly Good[]
): readonly (readonly TileId[])[] {
    const { regionTiles } = state.getPlayerState(playerId)
    return regionTiles.length === needs.length ? [regionTiles] : []
}

/** R-4.4-H1 The input's `wildTiles`: each picked tile brings the next good owed. */
export function coverSpends(picked: readonly TileId[], needs: readonly Good[]): WildTileSpend[] {
    return picked.map((tileId, index) => ({ tileId, good: needs[index] }))
}
