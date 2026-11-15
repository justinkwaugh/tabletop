import { TileUpgrades, type TileFace } from '@tabletop/18xx'
import { Map1862 } from './map.js'
import { TileColorOrder1862, TileSet1862 } from './tiles.js'

const count = (face: TileFace, kind: 'city' | 'town') =>
    face.nodes.filter((node) => node.kind === kind).length

/**
 * Large stations stay large stations of the same number. Small stations stay, or carry onto a
 * plain track tile's lines, where the family checks each still has its line (§7.6.3).
 */
export function preservesStops1862(before: TileFace, after: TileFace): boolean {
    if (count(before, 'city') !== count(after, 'city')) return false
    const towns = count(after, 'town')
    return towns === count(before, 'town') || (count(after, 'city') === 0 && towns === 0)
}

/** The tile rules construction and the home checks share. */
export const TileRules1862 = {
    map: Map1862,
    tileSet: TileSet1862,
    colorOrder: TileColorOrder1862,
    preservesStops: preservesStops1862,
    carriesTrackStops: true
} as const

export const TileUpgrades1862 = new TileUpgrades(TileRules1862)
