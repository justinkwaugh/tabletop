import {
    type Epoch,
    type LandscapeKind,
    type RegionId,
    tileById,
    type TileEpoch,
    type TileId,
    titled
} from '@tabletop/feudum'

export const EpochNames: Readonly<Record<Epoch, string>> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V'
}

export function tileName(tileId: TileId): string {
    const tile = tileById(tileId)
    return `${titled(tile.region)} ${EpochNames[tile.epoch]}`
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
    const tile = tileById(tileId)
    const landscape = state.tileLandscapes[tileId]
    return {
        kind: 'tile',
        name: tileName(tileId),
        epoch: tile.epoch,
        region: tile.region,
        ...(landscape ? { landscape } : {})
    }
}
