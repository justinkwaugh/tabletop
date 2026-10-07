import { CompanyId } from './companies.js'

export enum CityTier {
    White = 'White',
    Brown = 'Brown',
    Black = 'Black'
}

// Flat-topped hexes in doubled-height coordinates: columns run west to east, rows north to
// south in half-hex steps, so neighbours differ by two rows or by one column and one row.
export type HexDefinition = {
    id: string
    col: number
    row: number
}

export type CityDefinition = {
    id: string
    name: string
    tier: CityTier
    hexId: string
    startOf: readonly CompanyId[]
}

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

export function hexId(col: number, row: number): string {
    return `${col}-${row}`
}

export const HEXES: readonly HexDefinition[] = ROWS_BY_COLUMN.flatMap((rows, col) =>
    rows.map((row) => ({ id: hexId(col, row), col, row }))
)

export const CITIES: readonly CityDefinition[] = [
    { id: 'rocksprings', name: 'Rocksprings', tier: CityTier.Brown, hexId: '0-4', startOf: [] },
    { id: 'junction', name: 'Junction', tier: CityTier.Brown, hexId: '1-1', startOf: [] },
    { id: 'leakey', name: 'Leakey', tier: CityTier.White, hexId: '1-5', startOf: [] },
    { id: 'uvalde', name: 'Uvalde', tier: CityTier.Brown, hexId: '2-8', startOf: [] },
    { id: 'mason', name: 'Mason', tier: CityTier.White, hexId: '3-1', startOf: [] },
    { id: 'kerrville', name: 'Kerrville', tier: CityTier.White, hexId: '3-3', startOf: [] },
    { id: 'hondo', name: 'Hondo', tier: CityTier.White, hexId: '3-7', startOf: [] },
    {
        id: 'fredericksburg',
        name: 'Fredericksburg',
        tier: CityTier.Black,
        hexId: '4-2',
        startOf: [CompanyId.Streamside]
    },
    { id: 'boerne', name: 'Boerne', tier: CityTier.White, hexId: '4-6', startOf: [] },
    { id: 'johnson-city', name: 'Johnson City', tier: CityTier.White, hexId: '5-3', startOf: [] },
    {
        id: 'san-antonio',
        name: 'San Antonio',
        tier: CityTier.Black,
        hexId: '5-7',
        startOf: [CompanyId.AlamoCity, CompanyId.Verbena]
    },
    { id: 'burnet', name: 'Burnet', tier: CityTier.Brown, hexId: '6-0', startOf: [] },
    {
        id: 'new-braunfels',
        name: 'New Braunfels',
        tier: CityTier.White,
        hexId: '6-6',
        startOf: []
    },
    {
        id: 'austin',
        name: 'Austin',
        tier: CityTier.Black,
        hexId: '7-3',
        startOf: [CompanyId.CompleteComestibles]
    }
]

const DEVELOPMENT_CAPACITY: Record<CityTier, number> = {
    [CityTier.White]: 1,
    [CityTier.Brown]: 2,
    [CityTier.Black]: 3
}

export const HEX_CUBE_LIMIT = 2

const hexesById = new Map(HEXES.map((hex) => [hex.id, hex]))
const citiesById = new Map(CITIES.map((city) => [city.id, city]))
const citiesByHex = new Map(CITIES.map((city) => [city.hexId, city]))

export function hex(id: string): HexDefinition {
    const found = hexesById.get(id)
    if (!found) {
        throw Error(`Unknown hex ${id}`)
    }
    return found
}

export function city(id: string): CityDefinition {
    const found = citiesById.get(id)
    if (!found) {
        throw Error(`Unknown city ${id}`)
    }
    return found
}

export function cityInHex(hexId: string): CityDefinition | undefined {
    return citiesByHex.get(hexId)
}

export function developmentCapacity(cityId: string): number {
    return DEVELOPMENT_CAPACITY[city(cityId).tier]
}

// Austin, San Antonio and Fredericksburg hold any number of cubes.
export function hasCubeLimit(hexId: string): boolean {
    return (cityInHex(hexId)?.startOf.length ?? 0) === 0
}

export function neighbours(id: string): string[] {
    const { col, row } = hex(id)
    return [
        hexId(col, row - 2),
        hexId(col, row + 2),
        hexId(col - 1, row - 1),
        hexId(col - 1, row + 1),
        hexId(col + 1, row - 1),
        hexId(col + 1, row + 1)
    ].filter((candidate) => hexesById.has(candidate))
}

export function startingHex(companyId: CompanyId): string {
    const start = CITIES.find((candidate) => candidate.startOf.includes(companyId))
    if (!start) {
        throw Error(`${companyId} has no starting city`)
    }
    return start.hexId
}
