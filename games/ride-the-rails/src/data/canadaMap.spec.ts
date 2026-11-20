import { HexOrientation } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { City } from './boardMap.js'
import { adjacentHexIds, boardMap, cityById, hexById, isHexId } from './boardMaps.js'
import { CANADA_CITIES, CANADA_HEXES, CANADA_MAP } from './canadaMap.js'
import { flatHexCoordinates, flatToAxial, neighbourCellIds, type HexId } from './hexes.js'

// The printed board's cities in reading order: name, hex (col-drow), start colours, capacity,
// bonus.
const PRINTED_CITIES: readonly (readonly [string, string, string, string, string])[] = [
    ['Haileybury', '11-1', 'Black', '2', '—'],
    ['Sault Ste. Marie', '0-2', 'Yellow, Black', '2', '—'],
    ['Cartier', '6-2', 'Black', '2', '—'],
    ['Thessalon', '2-4', 'Black', '2', '—'],
    ['Blind River', '4-4', 'Black', '2', '—'],
    ['Sudbury', '8-4', 'Black', '2', '—'],
    ['Québec City', '30-4', 'Orange, Black', '2', '—'],
    ['North Bay', '11-5', 'Black', '2', '—'],
    ['Maniwaki', '19-5', 'Black', '2', '—'],
    ['Trois-Rivières', '27-5', 'Black', '2', '—'],
    ['Massey', '6-6', 'Black', '2', '—'],
    ['Saint-Jérôme', '22-6', 'Black', '2', '—'],
    ['Nicolet', '28-6', 'Black', '2', '—'],
    ['Mattawa', '13-7', 'Black', '2', '—'],
    ['Joliette', '25-7', 'Black', '2', '—'],
    ['Britt', '8-8', 'Black', '2', '—'],
    ['Pembroke', '16-8', 'Black', '2', '—'],
    ['Sorel-Tracy', '26-8', 'Black', '2', '—'],
    ['Thetford Mines', '30-8', 'Black', '2', '—'],
    ['Montréal', '24-10', 'Red, Black', '2', '—'],
    ['Asbestos', '28-10', 'Black', '2', '—'],
    ['Parry Sound', '9-11', 'Black', '2', '—'],
    ['Huntsville', '11-11', 'Black', '2', '—'],
    ["Barry's Bay", '15-11', 'Black', '2', '—'],
    ['Arnprior', '18-12', 'Black', '2', '—'],
    ['Ottawa', '20-12', 'Black', '2', '—'],
    ['Saint-Jean-sur-Richelieu', '25-13', 'Black', '2', '—'],
    ['Sutton', '27-13', 'Black', '2', '—'],
    ['Sherbrooke', '29-13', 'Black', '2', '—'],
    ['Owen Sound', '6-14', 'Black', '2', '—'],
    ['Orillia', '12-14', 'Black', '2', '—'],
    ['Bancroft', '14-14', 'Black', '2', '—'],
    ['Cornwall', '22-14', 'Black', '2', '—'],
    ['Barrie', '8-16', 'Black', '2', '—'],
    ['Peterborough', '10-16', 'Black', '2', '—'],
    ['Prescott', '20-16', 'Black', '2', '—'],
    ['Walkerton', '6-18', 'Black', '2', '—'],
    ['Lindsay', '12-18', 'Black', '2', '—'],
    ['Kingston', '18-18', 'Black', '2', '—'],
    ['Orangeville', '9-19', 'Black', '2', '—'],
    ['Belleville', '15-19', 'Black', '2', '—'],
    ['Goderich', '5-21', 'Black', '2', '—'],
    ['Kitchener', '7-21', 'Black', '2', '—'],
    ['Toronto', '11-21', 'Purple, Black', 'no limit', 'bonus.ca.toronto'],
    ['Hamilton', '9-23', 'Black', '2', '—'],
    ['Sarnia', '2-24', 'Black', '2', '—'],
    ['London', '6-24', 'Black', '2', '—'],
    ['Niagra Falls', '11-25', 'Black', '2', '—'],
    ['Simcoe', '8-26', 'Black', '2', '—'],
    ['Chatham', '3-27', 'Black', '2', '—'],
    ['St. Thomas', '5-27', 'Black', '2', '—'],
    ['Windsor', '1-29', 'Blue, Black', '2', '—']
]

// R-1.1: the box holds 52 passengers.
const BOX_PASSENGERS = 52

const MONTREAL: HexId = 'hex.ca.24-10'
const SOUTH_OF_MONTREAL: HexId = 'hex.ca.24-12'
const SOUTH_EAST_OF_MONTREAL: HexId = 'hex.ca.25-11'
const HAMILTON: HexId = 'hex.ca.9-23'
const NORTH_EAST_OF_HAMILTON: HexId = 'hex.ca.10-22'
const SOUTH_EAST_OF_HAMILTON: HexId = 'hex.ca.10-24'
const TROIS_RIVIERES: HexId = 'hex.ca.27-5'
const NICOLET: HexId = 'hex.ca.28-6'
const QUEBEC_CITY: HexId = 'hex.ca.30-4'
const SOUTH_WEST_OF_QUEBEC_CITY: HexId = 'hex.ca.29-5'

function printedStartColours(city: City): string {
    if (city.startColours.length === 0) {
        return '—'
    }
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
    return CANADA_HEXES.filter((hex) => hex.terrain === terrain).length
}

function neighbours(hexId: HexId): HexId[] {
    return [...adjacentHexIds(hexId)].sort()
}

// Whether two cells share a side on the flat grid, whether or not a hex is printed on each.
function gridNeighbours(a: HexId, b: HexId): boolean {
    return neighbourCellIds(HexOrientation.Flat, 'ca', flatToAxial(flatHexCoordinates(a))).includes(
        b
    )
}

describe('Canada map (R-8.3)', () => {
    describe('counts (the printed board’s totals)', () => {
        it('has 246 hexes: 194 plain and 52 cities, and no mountain', () => {
            expect(CANADA_HEXES).toHaveLength(246)
            expect(terrainCount('plain')).toBe(194)
            expect(terrainCount('city')).toBe(52)
            expect(terrainCount('mountain')).toBe(0)
            expect(CANADA_CITIES).toHaveLength(52)
            expect(CANADA_HEXES).toHaveLength(terrainCount('plain') + terrainCount('city'))
        })

        it('gives every hex and every city a unique id', () => {
            expect(new Set(CANADA_HEXES.map((hex) => hex.id)).size).toBe(CANADA_HEXES.length)
            expect(new Set(CANADA_CITIES.map((city) => city.id)).size).toBe(CANADA_CITIES.length)
        })
    })

    describe('the printed city table (the printed board)', () => {
        it('matches every row of the city table', () => {
            expect(CANADA_CITIES.map(printedCity)).toEqual(PRINTED_CITIES)
        })

        it('names each city in kebab case in the ca group, the printed spellings kept', () => {
            for (const city of CANADA_CITIES) {
                expect(city.id).toMatch(/^city\.ca\.[a-z]+(-[a-z]+)*$/)
            }
            expect(cityById('city.ca.niagra-falls').name).toBe('Niagra Falls')
            expect(cityById('city.ca.sault-ste-marie').name).toBe('Sault Ste. Marie')
            expect(cityById('city.ca.montreal').name).toBe('Montréal')
            expect(cityById('city.ca.quebec-city').name).toBe('Québec City')
        })

        it('prints Black on every city, and one other colour on five', () => {
            expect(
                CANADA_CITIES.every((city) => city.startColours.includes('railroad.black'))
            ).toBe(true)
            expect(
                CANADA_CITIES.filter((city) => city.startColours.length > 1).map((city) => [
                    city.id,
                    city.startColours
                ])
            ).toEqual([
                ['city.ca.sault-ste-marie', ['railroad.yellow', 'railroad.black']],
                ['city.ca.quebec-city', ['railroad.orange', 'railroad.black']],
                ['city.ca.montreal', ['railroad.red', 'railroad.black']],
                ['city.ca.toronto', ['railroad.purple', 'railroad.black']],
                ['city.ca.windsor', ['railroad.blue', 'railroad.black']]
            ])
        })

        it('belongs to no group: the map has no coasts the rules name', () => {
            expect(CANADA_CITIES.every((city) => city.groups.length === 0)).toBe(true)
        })
    })

    describe('integrity', () => {
        it('is the flat map map.ca, in the registry', () => {
            expect(CANADA_MAP).toMatchObject({
                id: 'map.ca',
                key: 'ca',
                orientation: HexOrientation.Flat
            })
            expect(boardMap('map.ca').hexes.map((hex) => hex.id)).toEqual(
                CANADA_HEXES.map((hex) => hex.id)
            )
        })

        it('puts every city on a city hex that names it', () => {
            for (const city of CANADA_CITIES) {
                expect(hexById(city.hexId)).toMatchObject({ terrain: 'city', cityId: city.id })
            }
        })

        it('gives every hex id a drow with the parity of its column, from column 0 and drow 1', () => {
            const coordinates = CANADA_HEXES.map((hex) => flatHexCoordinates(hex.id))
            for (const { col, drow } of coordinates) {
                expect(Math.abs(drow - col) % 2).toBe(0)
            }
            expect(Math.min(...coordinates.map(({ col }) => col))).toBe(0)
            expect(Math.min(...coordinates.map(({ drow }) => drow))).toBe(1)
            expect(flatHexCoordinates(cityById('city.ca.sault-ste-marie').hexId).col).toBe(0)
        })
    })

    describe('adjacency (R-4.1.2, rules-interpretations.md, Ids and coordinates)', () => {
        it('returns only hexes that exist', () => {
            for (const hex of CANADA_HEXES) {
                expect(adjacentHexIds(hex.id).every(isHexId)).toBe(true)
            }
        })

        it('is symmetric', () => {
            for (const hex of CANADA_HEXES) {
                for (const adjacentId of adjacentHexIds(hex.id)) {
                    expect(adjacentHexIds(adjacentId)).toContain(hex.id)
                }
            }
        })

        it('follows the flat formula (c, d±2), (c±1, d±1)', () => {
            expect(neighbours('hex.ca.4-26')).toEqual(
                [
                    'hex.ca.4-24',
                    'hex.ca.4-28',
                    'hex.ca.3-25',
                    'hex.ca.3-27',
                    'hex.ca.5-25',
                    'hex.ca.5-27'
                ].sort()
            )
        })

        it('keeps Toronto and Niagra Falls apart: water lies between them', () => {
            const toronto = cityById('city.ca.toronto').hexId
            const niagraFalls = cityById('city.ca.niagra-falls').hexId
            expect(isHexId('hex.ca.11-23')).toBe(false)
            expect(neighbours(toronto)).not.toContain(niagraFalls)
        })
    })

    describe('impassable sides (R-8.3)', () => {
        it('prints 18, each between two cells that share a side', () => {
            expect(CANADA_MAP.impassable).toHaveLength(18)
            for (const [a, b] of CANADA_MAP.impassable) {
                expect([a, b, gridNeighbours(a, b)]).toEqual([a, b, true])
            }
        })

        it('leaves every pair out of adjacency, both ways', () => {
            for (const [a, b] of CANADA_MAP.impassable) {
                if (isHexId(a)) {
                    expect(adjacentHexIds(a)).not.toContain(b)
                }
                if (isHexId(b)) {
                    expect(adjacentHexIds(b)).not.toContain(a)
                }
            }
        })

        it('puts two along the shore east of Cornwall, where one side is water', () => {
            expect(CANADA_MAP.impassable.filter(([a, b]) => !isHexId(a) || !isHexId(b))).toEqual([
                ['hex.ca.23-13', 'hex.ca.23-15'],
                ['hex.ca.23-13', 'hex.ca.24-14']
            ])
        })

        it('parts Montréal from the hex south of it, and not from the hex south-east', () => {
            expect(neighbours(MONTREAL)).not.toContain(SOUTH_OF_MONTREAL)
            expect(neighbours(MONTREAL)).toContain(SOUTH_EAST_OF_MONTREAL)
        })

        it('parts the two hexes east of Hamilton, and neither from Hamilton', () => {
            expect(neighbours(NORTH_EAST_OF_HAMILTON)).not.toContain(SOUTH_EAST_OF_HAMILTON)
            expect(neighbours(HAMILTON)).toEqual(
                expect.arrayContaining([NORTH_EAST_OF_HAMILTON, SOUTH_EAST_OF_HAMILTON])
            )
        })

        it('parts Trois-Rivières from Nicolet, and Québec City from the hex south-west of it', () => {
            expect(gridNeighbours(TROIS_RIVIERES, NICOLET)).toBe(true)
            expect(neighbours(TROIS_RIVIERES)).not.toContain(NICOLET)
            expect(neighbours(QUEBEC_CITY)).not.toContain(SOUTH_WEST_OF_QUEBEC_CITY)
        })
    })

    describe('capacity (R-4.1.4, R-8.3)', () => {
        it('gives Toronto no limit and every other hex two', () => {
            const map = boardMap('map.ca')
            const toronto = cityById('city.ca.toronto').hexId
            for (const hex of CANADA_HEXES) {
                expect([hex.id, map.capacity(hex.id)]).toEqual([
                    hex.id,
                    hex.id === toronto ? 'unlimited' : 2
                ])
            }
        })
    })

    describe('passengers (R-1.3.2, R-8.3)', () => {
        it('takes one at setup in every city: 52, the box’s 52', () => {
            const cityIds = boardMap('map.ca').setupPassengerCityIds()
            expect(cityIds).toHaveLength(52)
            expect(cityIds.length).toBeLessThanOrEqual(BOX_PASSENGERS)
            expect(cityIds).toEqual(CANADA_CITIES.map((city) => city.id))
        })
    })
})
