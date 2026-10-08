import {
    HexGrid,
    HexOrientation,
    assertExists,
    coordinatesToNumber,
    sameCoordinates,
    type AxialCoordinates,
    type HexGridNode
} from '@tabletop/common'
import { CompanyId } from './companies.js'

export enum CityTier {
    White = 'White',
    Brown = 'Brown',
    Black = 'Black'
}

export type CityDefinition = {
    id: string
    name: string
    tier: CityTier
    coords: AxialCoordinates
    startOf: readonly CompanyId[]
}

export type MapHex = HexGridNode & { cityId?: string }

// The printed map lists flat-topped hexes by column, west to east, each column's rows counted
// in half-hex steps from the top edge.
const ROWS_BY_COLUMN: readonly (readonly number[])[] = [
    [4],
    [1, 3, 5, 7],
    [0, 2, 4, 6, 8],
    [1, 3, 5, 7],
    [0, 2, 4, 6, 8],
    [1, 3, 5, 7],
    [0, 2, 4, 6],
    [1, 3, 5]
]

export function printedHex(col: number, row: number): AxialCoordinates {
    return { q: col, r: (row - col) / 2 }
}

export const CITIES: readonly CityDefinition[] = [
    {
        id: 'rocksprings',
        name: 'Rocksprings',
        tier: CityTier.Brown,
        coords: printedHex(0, 4),
        startOf: []
    },
    {
        id: 'junction',
        name: 'Junction',
        tier: CityTier.Brown,
        coords: printedHex(1, 1),
        startOf: []
    },
    { id: 'leakey', name: 'Leakey', tier: CityTier.White, coords: printedHex(1, 5), startOf: [] },
    { id: 'uvalde', name: 'Uvalde', tier: CityTier.Brown, coords: printedHex(2, 8), startOf: [] },
    { id: 'mason', name: 'Mason', tier: CityTier.White, coords: printedHex(3, 1), startOf: [] },
    {
        id: 'kerrville',
        name: 'Kerrville',
        tier: CityTier.White,
        coords: printedHex(3, 3),
        startOf: []
    },
    { id: 'hondo', name: 'Hondo', tier: CityTier.White, coords: printedHex(3, 7), startOf: [] },
    {
        id: 'fredericksburg',
        name: 'Fredericksburg',
        tier: CityTier.Black,
        coords: printedHex(4, 2),
        startOf: [CompanyId.Streamside]
    },
    { id: 'boerne', name: 'Boerne', tier: CityTier.White, coords: printedHex(4, 6), startOf: [] },
    {
        id: 'johnson-city',
        name: 'Johnson City',
        tier: CityTier.White,
        coords: printedHex(5, 3),
        startOf: []
    },
    {
        id: 'san-antonio',
        name: 'San Antonio',
        tier: CityTier.Black,
        coords: printedHex(5, 7),
        startOf: [CompanyId.AlamoCity, CompanyId.Verbena]
    },
    { id: 'burnet', name: 'Burnet', tier: CityTier.Brown, coords: printedHex(6, 0), startOf: [] },
    {
        id: 'new-braunfels',
        name: 'New Braunfels',
        tier: CityTier.White,
        coords: printedHex(6, 6),
        startOf: []
    },
    {
        id: 'austin',
        name: 'Austin',
        tier: CityTier.Black,
        coords: printedHex(7, 3),
        startOf: [CompanyId.CompleteComestibles]
    }
]

const DEVELOPMENT_CAPACITY: Record<CityTier, number> = {
    [CityTier.White]: 1,
    [CityTier.Brown]: 2,
    [CityTier.Black]: 3
}

export const HEX_CUBE_LIMIT = 2

const citiesById = new Map(CITIES.map((candidate) => [candidate.id, candidate]))

export class HillCountryMap extends HexGrid<MapHex> {
    constructor() {
        super({ hexDefinition: { orientation: HexOrientation.Flat } })
        ROWS_BY_COLUMN.forEach((rows, col) => {
            for (const row of rows) {
                const coords = printedHex(col, row)
                const found = CITIES.find((candidate) => sameCoordinates(candidate.coords, coords))
                this.setNode({
                    id: coordinatesToNumber(coords),
                    coords,
                    ...(found ? { cityId: found.id } : {})
                })
            }
        })
    }

    hexes(): MapHex[] {
        return [...this]
    }

    neighbourCoords(coords: AxialCoordinates): AxialCoordinates[] {
        return this.neighborsAt(coords).map((neighbour) => neighbour.coords)
    }
}

export const HILL_COUNTRY_MAP = new HillCountryMap()

export function hexKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

export function city(id: string): CityDefinition {
    const found = citiesById.get(id)
    assertExists(found, `Unknown city ${id}`)
    return found
}

export function cityAt(coords: AxialCoordinates): CityDefinition | undefined {
    const cityId = HILL_COUNTRY_MAP.nodeAt(coords)?.cityId
    return cityId === undefined ? undefined : city(cityId)
}

export function developmentCapacity(cityId: string): number {
    return DEVELOPMENT_CAPACITY[city(cityId).tier]
}

// Austin, San Antonio and Fredericksburg hold any number of cubes.
export function hasCubeLimit(coords: AxialCoordinates): boolean {
    return (cityAt(coords)?.startOf.length ?? 0) === 0
}

export function startingCoords(companyId: CompanyId): AxialCoordinates {
    const start = CITIES.find((candidate) => candidate.startOf.includes(companyId))
    assertExists(start, `${companyId} has no starting city`)
    return start.coords
}
