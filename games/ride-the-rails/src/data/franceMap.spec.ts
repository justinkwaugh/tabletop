import { HexOrientation } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { City } from './boardMap.js'
import { adjacentHexIds, boardMap, cityById, groupsOf, hexById, isHexId } from './boardMaps.js'
import { FRANCE_CITIES, FRANCE_HEXES, FRANCE_MAP, PARIS_ENTRY_HEXES } from './franceMap.js'
import { flatHexCoordinates, flatToAxial, neighbourCellIds, type HexId } from './hexes.js'

// The printed board's cities in reading order: name, hex (col-drow), start colours, capacity,
// bonus.
const PRINTED_CITIES: readonly (readonly [string, string, string, string, string])[] = [
    ['Dunkerque', '12-0', 'Orange, Black', '2', '—'],
    ['Lille', '15-1', 'Red, Blue, Black', '1', '—'],
    ['Valenciennes', '17-3', 'Red, Blue, Black', '1', '—'],
    ['Dieppe', '10-4', 'Black', '2', '—'],
    ['Cherbourg', '5-5', 'Orange, Black', '2', '—'],
    ['Le Havre', '8-6', 'Orange, Black', '2', '—'],
    ['Amiens', '13-7', 'Black', '2', '—'],
    ['Sedan', '19-7', 'Red, Blue, Black', '1', '—'],
    ['Caen', '8-8', 'Black', '2', '—'],
    ['Rouen', '10-8', 'Black', '2', '—'],
    ['Reims', '17-9', 'Black', '2', '—'],
    ['Metz', '21-9', 'Red, Blue, Black', '1', '—'],
    ['St. Lo', '6-10', 'Black', '2', '—'],
    ['Brest', '0-12', 'Orange, Black', '2', '—'],
    ['Nancy', '20-12', 'Black', '2', '—'],
    ['Strasbourg', '24-12', 'Purple, Black', '2', '—'],
    ['Rennes', '5-13', 'Black', '2', '—'],
    ['Paris', '13-13', 'Purple, Black', 'no limit', 'bonus.fr.paris'],
    ['Troyes', '16-14', 'Black', '2', '—'],
    ['Le Mans', '9-15', 'Black', '2', '—'],
    ['Lorient', '2-16', 'Black', '2', '—'],
    ['Chaumont', '18-16', 'Black', '2', '—'],
    ['Laroche', '15-17', 'Black', '2', '—'],
    ['St. Nazaire', '4-18', 'Black', '2', '—'],
    ['Nantes', '6-18', 'Black', '2', '—'],
    ['Tours', '10-18', 'Black', '2', '—'],
    ['Orleans', '12-18', 'Black', '2', '—'],
    ['Basel', '24-18', 'Purple, Black', '2', '—'],
    ['Besancon', '21-19', 'Black', '2', '—'],
    ['Dijon', '18-20', 'Black', '2', '—'],
    ['Chateauroux', '12-22', 'Black', '2', '—'],
    ['Poitiers', '9-23', 'Black', '2', '—'],
    ['La Rochelle', '6-24', 'Black', '2', '—'],
    ['Macon', '18-24', 'Black', '2', '—'],
    ['Geneve', '22-24', 'Purple, Black', '2', '—'],
    ['Vichy', '15-25', 'Black', '2', '—'],
    ['Culot', '20-26', 'Black', '2', '—'],
    ['Limonges', '11-27', 'Black', '2', '—'],
    ['Angouleme', '8-28', 'Black', '2', '—'],
    ['Clemont-Ferrand', '14-28', 'Black', '2', '—'],
    ['Lyon', '18-28', 'Purple, Black', '2', '—'],
    ['Perigueux', '10-30', 'Black', '2', '—'],
    ['Bordeaux', '7-31', 'Yellow, Black', '2', '—'],
    ['Valence', '18-32', 'Black', '2', '—'],
    ['Morcenx', '6-34', 'Black', '2', '—'],
    ['Capdenac', '12-34', 'Black', '2', '—'],
    ['Montauban', '9-35', 'Black', '2', '—'],
    ['Toulouse', '11-37', 'Yellow, Black', '2', '—'],
    ['Nimes', '17-37', 'Black', '2', '—'],
    ['Nice', '23-37', 'Black', '2', '—'],
    ['Narbonne', '14-40', 'Black', '2', '—'],
    ['Marseille', '20-40', 'Yellow, Black', '2', '—']
]

// The printed estuary sides, each between two hexes.
const PRINTED_ESTUARIES: readonly (readonly [HexId, HexId])[] = [
    ['hex.fr.8-6', 'hex.fr.8-8'],
    ['hex.fr.4-18', 'hex.fr.5-19'],
    ['hex.fr.5-17', 'hex.fr.5-19'],
    ['hex.fr.5-17', 'hex.fr.6-18'],
    ['hex.fr.6-24', 'hex.fr.6-26'],
    ['hex.fr.6-28', 'hex.fr.6-30'],
    ['hex.fr.7-29', 'hex.fr.6-30']
]

// R-1.1: the box holds 52 passengers.
const BOX_PASSENGERS = 52

const PARIS: HexId = 'hex.fr.13-13'
const LE_HAVRE: HexId = 'hex.fr.8-6'
const CAEN: HexId = 'hex.fr.8-8'
const ST_NAZAIRE: HexId = 'hex.fr.4-18'
const NANTES: HexId = 'hex.fr.6-18'
const LA_ROCHELLE: HexId = 'hex.fr.6-24'
const RED_BLUE_BLACK_CITIES = ['Lille', 'Valenciennes', 'Sedan', 'Metz']

function printedStartColours(city: City): string {
    return city.startColours
        .map((railroadId) => {
            const colour = railroadId.slice('railroad.'.length)
            return colour.charAt(0).toUpperCase() + colour.slice(1)
        })
        .join(', ')
}

function printedCity(city: City): readonly [string, string, string, string, string] {
    const { col, drow } = flatHexCoordinates(city.hexId)
    return [
        city.name,
        `${col}-${drow}`,
        printedStartColours(city),
        city.capacity === 'unlimited' ? 'no limit' : String(city.capacity),
        city.bonus ?? '—'
    ]
}

function terrainCount(terrain: string): number {
    return FRANCE_HEXES.filter((hex) => hex.terrain === terrain).length
}

function neighbours(hexId: HexId): HexId[] {
    return [...adjacentHexIds(hexId)].sort()
}

// Whether two cells share a side on the flat grid, whether or not a hex is printed on each.
function gridNeighbours(a: HexId, b: HexId): boolean {
    return neighbourCellIds(HexOrientation.Flat, 'fr', flatToAxial(flatHexCoordinates(a))).includes(
        b
    )
}

describe('France map (R-8.4)', () => {
    describe('counts (the printed board’s totals)', () => {
        it('has 358 hexes: 251 plain, 55 mountain and 52 cities', () => {
            expect(FRANCE_HEXES).toHaveLength(358)
            expect(terrainCount('plain')).toBe(251)
            expect(terrainCount('mountain')).toBe(55)
            expect(terrainCount('city')).toBe(52)
            expect(FRANCE_CITIES).toHaveLength(52)
        })

        it('prints 6 Paris entry hexes and 7 impassable sides', () => {
            expect(PARIS_ENTRY_HEXES).toHaveLength(6)
            expect(
                FRANCE_HEXES.filter((hex) => groupsOf(hex.id).includes('paris-entry'))
            ).toHaveLength(6)
            expect(FRANCE_MAP.impassable).toHaveLength(7)
        })

        it('gives every hex and every city a unique id', () => {
            expect(new Set(FRANCE_HEXES.map((hex) => hex.id)).size).toBe(FRANCE_HEXES.length)
            expect(new Set(FRANCE_CITIES.map((city) => city.id)).size).toBe(FRANCE_CITIES.length)
        })
    })

    describe('the printed city table (the printed board)', () => {
        it('matches every row of the city table', () => {
            expect(FRANCE_CITIES.map(printedCity)).toEqual(PRINTED_CITIES)
        })

        it('names each city in kebab case in the fr group, the printed spellings kept', () => {
            for (const city of FRANCE_CITIES) {
                expect(city.id).toMatch(/^city\.fr\.[a-z]+(-[a-z]+)*$/)
            }
            expect(cityById('city.fr.limonges').name).toBe('Limonges')
            expect(cityById('city.fr.clemont-ferrand').name).toBe('Clemont-Ferrand')
            expect(cityById('city.fr.culot').name).toBe('Culot')
            expect(cityById('city.fr.laroche').name).toBe('Laroche')
            expect(cityById('city.fr.morcenx').name).toBe('Morcenx')
            expect(cityById('city.fr.geneve').name).toBe('Geneve')
            expect(cityById('city.fr.besancon').name).toBe('Besancon')
            expect(cityById('city.fr.st-nazaire').name).toBe('St. Nazaire')
        })

        it('prints Black on every city', () => {
            expect(
                FRANCE_CITIES.every((city) => city.startColours.includes('railroad.black'))
            ).toBe(true)
        })

        it('groups the four Red/Blue/Black cities, and no other', () => {
            expect(
                FRANCE_CITIES.filter((city) => city.groups.length > 0).map((city) => [
                    city.name,
                    city.groups
                ])
            ).toEqual(RED_BLUE_BLACK_CITIES.map((name) => [name, ['red-blue-black']]))
        })
    })

    describe('integrity', () => {
        it('is the flat map map.fr, in the registry', () => {
            expect(FRANCE_MAP).toMatchObject({
                id: 'map.fr',
                key: 'fr',
                orientation: HexOrientation.Flat
            })
            expect(boardMap('map.fr').hexes.map((hex) => hex.id)).toEqual(
                FRANCE_HEXES.map((hex) => hex.id)
            )
        })

        it('puts every city on a city hex that names it', () => {
            for (const city of FRANCE_CITIES) {
                expect(hexById(city.hexId)).toMatchObject({ terrain: 'city', cityId: city.id })
            }
        })

        it('gives every hex id a drow with the parity of its column, from column 0 and drow 0', () => {
            const coordinates = FRANCE_HEXES.map((hex) => flatHexCoordinates(hex.id))
            for (const { col, drow } of coordinates) {
                expect(Math.abs(drow - col) % 2).toBe(0)
            }
            expect(Math.min(...coordinates.map(({ col }) => col))).toBe(0)
            expect(Math.min(...coordinates.map(({ drow }) => drow))).toBe(0)
            expect(flatHexCoordinates(cityById('city.fr.brest').hexId).col).toBe(0)
            expect(flatHexCoordinates(cityById('city.fr.dunkerque').hexId).drow).toBe(0)
        })

        it('covers one cell with each hex', () => {
            expect(FRANCE_HEXES.every((hex) => hex.extraCells === undefined)).toBe(true)
        })
    })

    describe('adjacency (R-4.1.2, rules-interpretations.md, Ids and coordinates)', () => {
        it('returns only hexes that exist', () => {
            for (const hex of FRANCE_HEXES) {
                expect(adjacentHexIds(hex.id).every(isHexId)).toBe(true)
            }
        })

        it('is symmetric', () => {
            for (const hex of FRANCE_HEXES) {
                for (const adjacentId of adjacentHexIds(hex.id)) {
                    expect(adjacentHexIds(adjacentId)).toContain(hex.id)
                }
            }
        })

        it('follows the flat formula (c, d±2), (c±1, d±1)', () => {
            expect(neighbours('hex.fr.9-19')).toEqual(
                [
                    'hex.fr.9-17',
                    'hex.fr.9-21',
                    'hex.fr.8-18',
                    'hex.fr.8-20',
                    'hex.fr.10-18',
                    'hex.fr.10-20'
                ].sort()
            )
        })

        it('rings Paris with the six entry hexes', () => {
            expect(neighbours(PARIS)).toEqual([...PARIS_ENTRY_HEXES].sort())
            for (const hexId of PARIS_ENTRY_HEXES) {
                expect(hexById(hexId).terrain).toBe('plain')
                expect(gridNeighbours(hexId, PARIS)).toBe(true)
            }
        })
    })

    describe('impassable sides (R-8.4)', () => {
        it('prints exactly the seven estuary sides, each between two hexes that share a side', () => {
            expect(FRANCE_MAP.impassable).toEqual(PRINTED_ESTUARIES)
            for (const [a, b] of FRANCE_MAP.impassable) {
                expect([a, b, isHexId(a), isHexId(b), gridNeighbours(a, b)]).toEqual([
                    a,
                    b,
                    true,
                    true,
                    true
                ])
            }
        })

        it('leaves every pair out of adjacency, both ways', () => {
            for (const [a, b] of FRANCE_MAP.impassable) {
                expect(adjacentHexIds(a)).not.toContain(b)
                expect(adjacentHexIds(b)).not.toContain(a)
            }
        })

        it('parts Le Havre from Caen, St. Nazaire and Nantes from the Loire’s far bank, and La Rochelle from the hex south of it', () => {
            expect(neighbours(LE_HAVRE)).not.toContain(CAEN)
            expect(neighbours(ST_NAZAIRE)).not.toContain('hex.fr.5-19')
            expect(neighbours(NANTES)).not.toContain('hex.fr.5-17')
            expect(neighbours(ST_NAZAIRE)).toContain('hex.fr.5-17')
            expect(neighbours(LA_ROCHELLE)).not.toContain('hex.fr.6-26')
        })
    })

    describe('capacity (R-4.1.4, R-8.4)', () => {
        it('gives Paris no limit, the Red/Blue/Black cities and the entry hexes one, and every other hex two', () => {
            const map = boardMap('map.fr')
            const ones = new Set<HexId>([
                ...PARIS_ENTRY_HEXES,
                ...FRANCE_CITIES.filter((city) => RED_BLUE_BLACK_CITIES.includes(city.name)).map(
                    (city) => city.hexId
                )
            ])
            for (const hex of FRANCE_HEXES) {
                const expected = hex.id === PARIS ? 'unlimited' : ones.has(hex.id) ? 1 : 2
                expect([hex.id, map.capacity(hex.id)]).toEqual([hex.id, expected])
            }
        })
    })

    describe('passengers (R-1.3.2, R-8.4)', () => {
        it('takes one at setup in every city, Paris included: 52, the box’s 52', () => {
            const cityIds = boardMap('map.fr').setupPassengerCityIds()
            expect(cityIds).toHaveLength(52)
            expect(cityIds.length).toBeLessThanOrEqual(BOX_PASSENGERS)
            expect(cityIds).toEqual(FRANCE_CITIES.map((city) => city.id))
        })
    })
})
