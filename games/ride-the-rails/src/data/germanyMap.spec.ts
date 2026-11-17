import { HexOrientation } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { City } from './boardMap.js'
import { adjacentHexIds, boardMap, cityById, hexById, isHexId } from './boardMaps.js'
import { GERMANY_CITIES, GERMANY_HEXES, GERMANY_MAP } from './germanyMap.js'
import { flatHexCoordinates, type HexId } from './hexes.js'

// The printed board's cities in reading order: name, hex (col-drow; Berlin's north-west cell),
// start colours, capacity, bonus.
const PRINTED_CITIES: readonly (readonly [string, string, string, string, string])[] = [
    ['Flensburg', '10-0', 'Black', '2', '—'],
    ['Kiel', '11-3', 'Yellow, Black', '2', '—'],
    ['Stralsund', '18-4', 'Black', '2', '—'],
    ['Rostock', '16-6', 'Black', '2', '—'],
    ['Greifswald', '20-6', 'Black', '2', '—'],
    ['Lübeck', '13-7', 'Black', '2', '—'],
    ['Hamburg', '10-8', 'Yellow, Black', '2', '—'],
    ['Bremerhaven', '7-9', 'Black', '2', '—'],
    ['Schwerin', '15-9', 'Black', '2', '—'],
    ['Bremen', '9-11', 'Black', '2', '—'],
    ['Neubrandenburg', '19-11', 'Black', '2', '—'],
    ['Oldenburg', '6-12', 'Black', '2', '—'],
    ['Hannover', '10-16', 'Black', '2', '—'],
    ['Wolfsburg', '13-17', 'Black', '2', '—'],
    ['Berlin', '19-17', 'Purple, Black', 'no limit', 'bonus.de.berlin'],
    ['Osnabrück', '6-18', 'Black', '2', '—'],
    ['Potsdam', '17-19', 'Black', '2', '—'],
    ['Bielefeld', '8-20', 'Black', '2', '—'],
    ['Braunschweig', '12-20', 'Black', '2', '—'],
    ['Münster', '5-21', 'Black', '2', '—'],
    ['Magdeburg', '15-21', 'Black', '2', '—'],
    ['Göttingen', '11-23', 'Black', '2', '—'],
    ['Dessau', '17-23', 'Black', '2', '—'],
    ['Essen', '4-24', 'Red, Blue, Black', '2', '—'],
    ['Kottbus', '22-24', 'Black', '2', '—'],
    ['Halle', '15-25', 'Black', '2', '—'],
    ['Düsseldorf', '2-26', 'Black', '2', '—'],
    ['Kassel', '9-27', 'Purple, Black', '2', '—'],
    ['Leipzig', '17-27', 'Red, Blue, Black', '2', '—'],
    ['Erfurt', '13-29', 'Purple, Black', '2', '—'],
    ['Dresden', '21-29', 'Red, Blue, Black', '2', '—'],
    ['Aachen', '0-30', 'Black', '2', '—'],
    ['Köln', '2-30', 'Red, Blue, Black', '2', '—'],
    ['Jena', '16-30', 'Black', '2', '—'],
    ['Chemnitz', '18-30', 'Black', '2', '—'],
    ['Koblenz', '4-32', 'Black', '2', '—'],
    ['Frankfurt', '7-35', 'Black', '2', '—'],
    ['Trier', '1-37', 'Black', '2', '—'],
    ['Mainz', '5-37', 'Black', '2', '—'],
    ['Würzburg', '10-38', 'Black', '2', '—'],
    ['Kaiserslautern', '3-39', 'Black', '2', '—'],
    ['Heidelberg', '7-39', 'Black', '2', '—'],
    ['Nürnberg', '13-41', 'Black', '2', '—'],
    ['Saarbrücken', '2-42', 'Black', '2', '—'],
    ['Heilbronn', '8-42', 'Black', '2', '—'],
    ['Karlsruhe', '5-43', 'Black', '2', '—'],
    ['Regensburg', '16-44', 'Black', '2', '—'],
    ['Stuttgart', '8-46', 'Orange, Black', '2', '—'],
    ['Ulm', '10-48', 'Black', '2', '—'],
    ['Augsburg', '13-49', 'Black', '2', '—'],
    ['Freiburg', '4-50', 'Orange, Black', '2', '—'],
    ['München', '15-51', 'Orange, Black', '2', '—']
]

// R-1.1: the box holds 52 passengers.
const BOX_PASSENGERS = 52

const BERLIN: HexId = 'hex.de.19-17'
const BERLIN_SOUTH_EAST_CELL: HexId = 'hex.de.20-18'

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

function cellCount(terrain: string): number {
    return GERMANY_HEXES.filter((hex) => hex.terrain === terrain)
        .map((hex) => boardMap('map.de').cellsOf(hex.id).length)
        .reduce((sum, cells) => sum + cells, 0)
}

function neighbours(hexId: HexId): HexId[] {
    return [...adjacentHexIds(hexId)].sort()
}

describe('Germany map (R-8.5)', () => {
    describe('counts (the printed board’s totals)', () => {
        it('has 442 cells: 279 plain, 110 mountain and 53 of cities', () => {
            expect(cellCount('plain')).toBe(279)
            expect(cellCount('mountain')).toBe(110)
            expect(cellCount('city')).toBe(53)
            expect(cellCount('plain') + cellCount('mountain') + cellCount('city')).toBe(442)
        })

        it('has 52 cities over those 53 cells, so 441 hexes', () => {
            expect(GERMANY_CITIES).toHaveLength(52)
            expect(GERMANY_HEXES.filter((hex) => hex.terrain === 'city')).toHaveLength(52)
            expect(GERMANY_HEXES).toHaveLength(441)
        })

        it('gives every hex and every city a unique id', () => {
            expect(new Set(GERMANY_HEXES.map((hex) => hex.id)).size).toBe(GERMANY_HEXES.length)
            expect(new Set(GERMANY_CITIES.map((city) => city.id)).size).toBe(GERMANY_CITIES.length)
        })
    })

    describe('the printed city table (the printed board)', () => {
        it('matches every row of the city table', () => {
            expect(GERMANY_CITIES.map(printedCity)).toEqual(PRINTED_CITIES)
        })

        it('names each city in kebab case in the de group, without accents, the printed spellings kept', () => {
            for (const city of GERMANY_CITIES) {
                expect(city.id).toMatch(/^city\.de\.[a-z]+(-[a-z]+)*$/)
            }
            expect(cityById('city.de.koln').name).toBe('Köln')
            expect(cityById('city.de.munchen').name).toBe('München')
            expect(cityById('city.de.munster').name).toBe('Münster')
            expect(cityById('city.de.dusseldorf').name).toBe('Düsseldorf')
            expect(cityById('city.de.kottbus').name).toBe('Kottbus')
        })

        it('prints Black on every city', () => {
            expect(
                GERMANY_CITIES.every((city) => city.startColours.includes('railroad.black'))
            ).toBe(true)
        })

        it('prints Purple on Kassel, Erfurt and Berlin only', () => {
            expect(
                GERMANY_CITIES.filter((city) => city.startColours.includes('railroad.purple')).map(
                    (city) => city.id
                )
            ).toEqual(['city.de.berlin', 'city.de.kassel', 'city.de.erfurt'])
        })

        it('belongs to no group: the board prints no x1 and no group limit', () => {
            expect(GERMANY_CITIES.every((city) => city.groups.length === 0)).toBe(true)
        })
    })

    describe('integrity', () => {
        it('is the flat map map.de, in the registry, with no impassable side', () => {
            expect(GERMANY_MAP).toMatchObject({
                id: 'map.de',
                key: 'de',
                orientation: HexOrientation.Flat,
                impassable: []
            })
            expect(boardMap('map.de').hexes.map((hex) => hex.id)).toEqual(
                GERMANY_HEXES.map((hex) => hex.id)
            )
        })

        it('puts every city on a city hex that names it', () => {
            for (const city of GERMANY_CITIES) {
                expect(hexById(city.hexId)).toMatchObject({ terrain: 'city', cityId: city.id })
            }
        })

        it('gives every hex id a drow with the parity of its column, from column 0 and drow 0', () => {
            const coordinates = GERMANY_HEXES.map((hex) => flatHexCoordinates(hex.id))
            for (const { col, drow } of coordinates) {
                expect(Math.abs(drow - col) % 2).toBe(0)
            }
            expect(Math.min(...coordinates.map(({ col }) => col))).toBe(0)
            expect(Math.min(...coordinates.map(({ drow }) => drow))).toBe(0)
            expect(flatHexCoordinates(cityById('city.de.aachen').hexId).col).toBe(0)
            expect(flatHexCoordinates(cityById('city.de.flensburg').hexId).drow).toBe(0)
        })
    })

    describe('Berlin, one city over two hexes (R-8.5)', () => {
        it('is one hex id covering its two cells, the second no hex of its own', () => {
            expect(cityById('city.de.berlin').hexId).toBe(BERLIN)
            expect(boardMap('map.de').cellsOf(BERLIN)).toEqual([
                { q: 19, r: -1 },
                { q: 20, r: -1 }
            ])
            expect(isHexId(BERLIN_SOUTH_EAST_CELL)).toBe(false)
            expect(GERMANY_HEXES.filter((hex) => hex.extraCells !== undefined)).toEqual([
                expect.objectContaining({ id: BERLIN })
            ])
        })

        it('neighbours every hex beside either cell, less the two cells themselves', () => {
            expect(neighbours(BERLIN)).toEqual(
                [
                    'hex.de.19-15',
                    'hex.de.18-16',
                    'hex.de.20-16',
                    'hex.de.18-18',
                    'hex.de.19-19',
                    'hex.de.21-17',
                    'hex.de.21-19',
                    'hex.de.20-20'
                ].sort()
            )
            expect(neighbours('hex.de.21-19')).toContain(BERLIN)
            expect(neighbours('hex.de.18-16')).toContain(BERLIN)
        })

        it('takes one passenger at setup', () => {
            const cityIds = boardMap('map.de').setupPassengerCityIds()
            expect(cityIds.filter((cityId) => cityId === 'city.de.berlin')).toEqual([
                'city.de.berlin'
            ])
        })
    })

    describe('adjacency (R-4.1.2, rules-interpretations.md, Ids and coordinates)', () => {
        it('returns only hexes that exist', () => {
            for (const hex of GERMANY_HEXES) {
                expect(adjacentHexIds(hex.id).every(isHexId)).toBe(true)
            }
        })

        it('is symmetric', () => {
            for (const hex of GERMANY_HEXES) {
                for (const adjacentId of adjacentHexIds(hex.id)) {
                    expect(adjacentHexIds(adjacentId)).toContain(hex.id)
                }
            }
        })

        it('follows the flat formula (c, d±2), (c±1, d±1)', () => {
            expect(neighbours('hex.de.2-30')).toEqual(
                [
                    'hex.de.2-28',
                    'hex.de.2-32',
                    'hex.de.1-29',
                    'hex.de.1-31',
                    'hex.de.3-29',
                    'hex.de.3-31'
                ].sort()
            )
        })
    })

    describe('capacity (R-4.1.4, R-8.5)', () => {
        it('gives Berlin no limit and every other hex two, the Red/Blue/Black cities included', () => {
            const map = boardMap('map.de')
            for (const hex of GERMANY_HEXES) {
                expect([hex.id, map.capacity(hex.id)]).toEqual([
                    hex.id,
                    hex.id === BERLIN ? 'unlimited' : 2
                ])
            }
        })
    })

    describe('passengers (R-1.3.2, R-8.5)', () => {
        it('takes one at setup in every city: 52, the box’s 52', () => {
            const cityIds = boardMap('map.de').setupPassengerCityIds()
            expect(cityIds).toHaveLength(52)
            expect(cityIds.length).toBeLessThanOrEqual(BOX_PASSENGERS)
            expect(cityIds).toEqual(GERMANY_CITIES.map((city) => city.id))
        })
    })
})
