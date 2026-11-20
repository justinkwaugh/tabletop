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

export function tileName(tileId: TileId): string {
    const tile = RegionTiles.find(({ id }) => id === tileId)
    if (!tile) {
        return tileId
    }
    return `${tile.region.charAt(0).toUpperCase()}${tile.region.slice(1)} ${EpochNames[tile.epoch]}`
}

export interface TileArt {
    readonly kind: 'tile'
    readonly name: string
    readonly epoch: TileEpoch
    readonly region: RegionId
    readonly landscape?: LandscapeKind
}

/** R-4.3, R-5.3 A collected tile's landscape is public. */
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
