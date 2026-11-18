import { HexOrientation } from '@tabletop/common'
import type { City, CityHex, Hex, Terrain, TerrainHex } from './boardMap.js'
import { compareReadingOrder, flatHexId } from './hexes.js'
import type { MapKey } from './maps.js'

type LandTerrain = Exclude<Terrain, 'city'>

// One column of a flat map as printed, west to east: the drows of each terrain, north to south.
export type TerrainColumn = { readonly [terrain in LandTerrain]?: readonly number[] }

const LAND_TERRAINS: readonly LandTerrain[] = ['plain', 'mountain', 'alps', 'long-distance']

// A flat map's terrain hexes from its columns, the first column col 0.
export function flatTerrainHexes(mapKey: MapKey, columns: readonly TerrainColumn[]): TerrainHex[] {
    return columns.flatMap((column, col) =>
        LAND_TERRAINS.flatMap((terrain) =>
            (column[terrain] ?? []).map((drow): TerrainHex => ({
                id: flatHexId(mapKey, { col, drow }),
                terrain
            }))
        )
    )
}

// A flat map's hexes, its terrain and its cities, in reading order.
export function flatMapHexes(
    mapKey: MapKey,
    columns: readonly TerrainColumn[],
    cities: readonly City[]
): Hex[] {
    const cityHexes = cities.map((city): CityHex => ({
        id: city.hexId,
        terrain: 'city',
        cityId: city.id
    }))
    return [...flatTerrainHexes(mapKey, columns), ...cityHexes].sort((a, b) =>
        compareReadingOrder(HexOrientation.Flat, a.id, b.id)
    )
}
