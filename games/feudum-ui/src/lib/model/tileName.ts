import { RegionTiles, type Epoch, type TileId } from '@tabletop/feudum'

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
