import {
    RegionTiles,
    type Epoch,
    type LandscapeKind,
    type RegionId,
    type TileEpoch,
    type TileId
} from '@tabletop/feudum'
import { assertExists } from '@tabletop/common'

export const EpochNames: Readonly<Record<Epoch, string>> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V'
}

/** A tile as a player reads it: its region and epoch. */
export function tileName(tileId: TileId): string {
    const tile = RegionTiles.find(({ id }) => id === tileId)
    if (!tile) {
        return tileId
    }
    return `${tile.region.charAt(0).toUpperCase()}${tile.region.slice(1)} ${EpochNames[tile.epoch]}`
}

/** A tile a row offers, drawn as its piece: its epoch side, or its landscape once that is known. */
export interface TileArt {
    readonly kind: 'tile'
    /** "Badlands I": the row keeps it in its accessible name. */
    readonly name: string
    readonly epoch: TileEpoch
    readonly region: RegionId
    readonly landscape?: LandscapeKind
}

/**
 * R-4.3 A collected tile's landscape is public (R-5.3), so the view holds it and the art turns to
 * it; a tile whose landscape the view doesn't hold shows its epoch side.
 */
export function tileArt(
    state: { readonly tileLandscapes: Readonly<Record<string, LandscapeKind>> },
    tileId: TileId
): TileArt {
    const tile = RegionTiles.find(({ id }) => id === tileId)
    assertExists(tile, `R-4.3 There is a region tile ${tileId}`)
    const landscape = state.tileLandscapes[tileId]
    return {
        kind: 'tile',
        name: tileName(tileId),
        epoch: tile.epoch,
        region: tile.region,
        ...(landscape ? { landscape } : {})
    }
}
