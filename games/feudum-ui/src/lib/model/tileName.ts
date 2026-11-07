import { RegionTiles, type TileEpoch, type TileId } from '@tabletop/feudum'

const EpochNames: Readonly<Record<TileEpoch, string>> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

/** A tile as a player reads it: its region and epoch. */
export function tileName(tileId: TileId): string {
    const tile = RegionTiles.find(({ id }) => id === tileId)
    if (!tile) {
        return tileId
    }
    return `${tile.region.charAt(0).toUpperCase()}${tile.region.slice(1)} ${EpochNames[tile.epoch]}`
}
