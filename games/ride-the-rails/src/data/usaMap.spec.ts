import { describe, expect, it } from 'vitest'
import { hexCoordinates } from './hexes.js'
import type { City, CityId } from './boardMap.js'
import { adjacentHexIds, cityById, hexById, isHexId } from './boardMaps.js'
import { USA_CITIES, USA_HEXES } from './usaMap.js'

// usaMap.ts, Cities: id, printed name, hex, start colours, capacity, bonus
const PRINTED_CITIES: readonly (readonly [string, string, string, string, string, string])[] = [
    ['city.usa.seattle', 'Seattle', '0-4', 'Purple, Black', '2', '—'],
    ['city.usa.spokane', 'Spokane', '0-10', '—', '2', '—'],
    ['city.usa.billings', 'Billings', '0-22', '—', '2', '—'],
    ['city.usa.fargo', 'Fargo', '0-32', '—', '2', '—'],
    ['city.usa.butte', 'Butte', '1-17', '—', '2', '—'],
    ['city.usa.bismarck', 'Bismarck', '1-27', '—', '2', '—'],
    ['city.usa.green-bay', 'Green Bay', '1-43', '—', '2', '—'],
    ['city.usa.portland-or', 'Portland (Oregon)', '2-4', 'Purple, Black', '2', '—'],
    ['city.usa.minneapolis', 'Minneapolis', '2-36', '—', '2', 'bonus.usa.five-dollar'],
    ['city.usa.portland-me', 'Portland (Maine)', '2-64', '—', '2', '—'],
    ['city.usa.rapid-city', 'Rapid City', '3-25', '—', '2', '—'],
    ['city.usa.milwaukee', 'Milwaukee', '3-41', '—', '2', '—'],
    ['city.usa.boise', 'Boise', '4-10', '—', '2', '—'],
    ['city.usa.pocatello', 'Pocatello', '4-16', '—', '2', '—'],
    ['city.usa.detroit', 'Detroit', '4-48', '—', '2', '—'],
    ['city.usa.buffalo', 'Buffalo', '4-52', '—', '2', '—'],
    ['city.usa.albany', 'Albany', '4-58', '—', '2', '—'],
    ['city.usa.boston', 'Boston', '4-62', '—', '2', '—'],
    ['city.usa.cheyenne', 'Cheyenne', '5-23', '—', '2', '—'],
    ['city.usa.omaha', 'Omaha', '5-31', '—', '2', '—'],
    ['city.usa.des-moines', 'Des Moines', '5-37', '—', '2', '—'],
    [
        'city.usa.chicago',
        'Chicago',
        '5-43',
        'Orange, Yellow, Black',
        'no limit',
        'bonus.usa.chicago'
    ],
    ['city.usa.salt-lake-city', 'Salt Lake City', '6-16', '—', '2', '—'],
    ['city.usa.new-york', 'New York', '6-60', 'Blue, Red, Orange, Black', '1', '—'],
    ['city.usa.reno', 'Reno', '7-7', '—', '2', '—'],
    ['city.usa.pittsburgh', 'Pittsburgh', '7-51', '—', '2', '—'],
    ['city.usa.philadelphia', 'Philadelphia', '7-57', 'Blue, Red, Orange, Black', '1', '—'],
    ['city.usa.denver', 'Denver', '8-22', '—', '2', 'bonus.usa.five-dollar'],
    ['city.usa.kansas-city', 'Kansas City', '8-32', '—', '2', 'bonus.usa.five-dollar'],
    ['city.usa.saint-louis', 'Saint Louis', '8-38', '—', '2', '—'],
    ['city.usa.cincinnati', 'Cincinnati', '8-46', '—', '2', '—'],
    ['city.usa.san-francisco', 'San Francisco', '9-5', 'Purple, Black', '2', '—'],
    ['city.usa.baltimore', 'Baltimore', '9-55', 'Blue, Red, Orange, Black', '1', '—'],
    ['city.usa.las-vegas', 'Las Vegas', '10-14', '—', '2', '—'],
    ['city.usa.oklahoma-city', 'Oklahoma City', '10-30', '—', '2', '—'],
    ['city.usa.nashville', 'Nashville', '10-42', '—', '2', '—'],
    ['city.usa.santa-fe', 'Santa Fe', '11-21', '—', '2', '—'],
    ['city.usa.little-rock', 'Little Rock', '11-37', '—', '2', '—'],
    ['city.usa.washington', 'Washington', '11-55', 'Blue, Red, Orange, Black', '1', '—'],
    ['city.usa.los-angeles', 'Los Angeles', '12-10', 'Purple, Black', '2', '—'],
    ['city.usa.atlanta', 'Atlanta', '12-46', '—', '2', '—'],
    ['city.usa.charleston', 'Charleston', '12-52', 'Blue, Red, Orange, Black', '1', '—'],
    ['city.usa.phoenix', 'Phoenix', '13-17', '—', '2', '—'],
    ['city.usa.dallas', 'Dallas', '13-31', '—', '2', 'bonus.usa.five-dollar'],
    ['city.usa.el-paso', 'El Paso', '14-24', '—', '2', '—'],
    ['city.usa.jacksonville', 'Jacksonville', '14-50', 'Blue, Red, Orange, Black', '1', '—'],
    ['city.usa.houston', 'Houston', '15-35', '—', '2', '—'],
    ['city.usa.new-orleans', 'New Orleans', '15-41', '—', '2', '—'],
    ['city.usa.tampa', 'Tampa', '16-48', '—', '2', '—'],
    ['city.usa.corpus-christi', 'Corpus Christi', '17-31', '—', '2', '—'],
    ['city.usa.miami', 'Miami', '18-50', '—', '2', '—']
]

// usaMap.ts, Terrain: row, plain dcols, mountain dcols
const PRINTED_TERRAIN: readonly (readonly [number, string, string])[] = [
    [0, '8 12 16 18 20 24 26 28 30 34 36 38 64', '6 14'],
    [1, '3 7 9 11 19 21 23 25 29 31 33 35 37 39 41 63', '5 13 15'],
    [2, '8 10 18 20 22 24 26 28 30 32 34 38 40 42 46 58 60 62', '6 12 14 16'],
    [3, '3 7 9 11 13 21 23 27 29 31 33 35 37 39 45 47 57 61', '5 15 17 19 59'],
    [4, '4 8 12 14 20 22 24 26 28 30 32 34 36 38 40 42 46 54 56 60', '6 18'],
    [5, '3 7 9 11 13 15 17 19 21 25 27 29 33 35 39 41 45 47 53 55 59 61 63', '5 57'],
    [6, '4 8 10 12 14 18 22 24 26 28 30 32 34 36 38 40 42 44 46 48 50 52 58', '6 20 54 56'],
    [7, '3 9 11 13 15 17 23 25 27 29 31 33 35 37 39 41 43 45 47 49 55', '5 19 21 53'],
    [8, '4 10 12 14 16 24 26 28 30 34 36 40 42 44 48 50 54 56', '6 8 18 20 52'],
    [9, '7 11 13 15 23 25 27 29 31 33 37 39 41 43 45 47 53', '9 17 19 21 35 49 51'],
    [10, '6 8 12 16 22 24 26 28 32 38 40 44 46 52 54 56', '10 18 20 34 36 48 50'],
    [11, '7 9 13 15 19 23 25 27 29 31 33 35 39 41 43 45 47 51 53', '11 17 49'],
    [12, '12 14 18 20 22 24 26 28 30 32 34 36 38 40 42 44 48 50', '16'],
    [13, '11 13 15 19 21 23 25 27 29 33 35 37 39 41 43 45 47 49 51', '—'],
    [14, '18 20 22 26 28 30 32 34 36 38 40 42 44 46 48', '—'],
    [15, '25 27 29 31 33 47 49', '—'],
    [16, '30 32 50', '—'],
    [17, '49 51', '—'],
    [18, '—', '—']
]

const EAST_COAST_CITIES: readonly CityId[] = [
    'city.usa.new-york',
    'city.usa.philadelphia',
    'city.usa.baltimore',
    'city.usa.washington',
    'city.usa.charleston',
    'city.usa.jacksonville'
]

const WEST_COAST_CITIES: readonly CityId[] = [
    'city.usa.seattle',
    'city.usa.portland-or',
    'city.usa.san-francisco',
    'city.usa.los-angeles'
]

const FIVE_DOLLAR_CITIES: readonly CityId[] = [
    'city.usa.minneapolis',
    'city.usa.denver',
    'city.usa.kansas-city',
    'city.usa.dallas'
]

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

function printedCity(city: City): readonly [string, string, string, string, string, string] {
    const { row, dcol } = hexCoordinates(city.hexId)
    return [
        city.id,
        city.name,
        `${row}-${dcol}`,
        printedStartColours(city),
        city.capacity === 'unlimited' ? 'no limit' : String(city.capacity),
        city.bonus ?? '—'
    ]
}

function printedDcols(row: number, terrain: 'plain' | 'mountain'): string {
    const dcols = USA_HEXES.filter((hex) => hex.row === row && hex.terrain === terrain).map(
        (hex) => hex.dcol
    )
    return dcols.length === 0 ? '—' : dcols.join(' ')
}

function citiesWithGroup(group: 'east-coast' | 'west-coast'): string[] {
    return USA_CITIES.filter((city) => city.groups.includes(group)).map((city) => city.id)
}

describe('USA map (R-8.1)', () => {
    describe('counts (the printed board’s totals)', () => {
        it('has 386 hexes in 19 rows: 286 plain, 49 mountain, 51 cities', () => {
            expect(USA_HEXES).toHaveLength(386)
            expect(USA_HEXES.filter((hex) => hex.terrain === 'plain')).toHaveLength(286)
            expect(USA_HEXES.filter((hex) => hex.terrain === 'mountain')).toHaveLength(49)
            expect(USA_HEXES.filter((hex) => hex.terrain === 'city')).toHaveLength(51)
            expect(USA_CITIES).toHaveLength(51)
            expect(new Set(USA_HEXES.map((hex) => hex.row))).toEqual(
                new Set(Array.from({ length: 19 }, (_, row) => row))
            )
        })

        it('gives every hex and every city a unique id', () => {
            expect(new Set(USA_HEXES.map((hex) => hex.id)).size).toBe(USA_HEXES.length)
            expect(new Set(USA_CITIES.map((city) => city.id)).size).toBe(USA_CITIES.length)
        })
    })

    describe('the printed tables (the printed board)', () => {
        it('matches every row of the city table', () => {
            expect(USA_CITIES.map(printedCity)).toEqual(PRINTED_CITIES)
        })

        it('matches every row of the terrain table', () => {
            const rows = PRINTED_TERRAIN.map(([row]) => row)
            expect(
                rows.map((row) => [row, printedDcols(row, 'plain'), printedDcols(row, 'mountain')])
            ).toEqual(PRINTED_TERRAIN)
        })
    })

    describe('city groups and capacities (R-4.1.4, R-4.2, R-4.3)', () => {
        it('gives the six East Coast cities capacity 1 and the east-coast group (R-4.1.4)', () => {
            expect(citiesWithGroup('east-coast')).toEqual(EAST_COAST_CITIES)
            for (const cityId of EAST_COAST_CITIES) {
                expect(USA_CITIES.find((city) => city.id === cityId)?.capacity).toBe(1)
            }
        })

        it('gives Chicago no limit at hex.usa.5-43 (R-4.1.4)', () => {
            const chicago = cityById('city.usa.chicago')
            expect(chicago.hexId).toBe('hex.usa.5-43')
            expect(chicago.capacity).toBe('unlimited')
        })

        it('gives every other city capacity 2 (R-4.1.4)', () => {
            const others = USA_CITIES.filter(
                (city) => city.id !== 'city.usa.chicago' && !EAST_COAST_CITIES.includes(city.id)
            )
            expect(others).toHaveLength(44)
            expect(others.every((city) => city.capacity === 2)).toBe(true)
        })

        it('gives the four West Coast cities the west-coast group and Purple (R-4.2.4, R-4.3.3)', () => {
            expect(citiesWithGroup('west-coast')).toEqual(WEST_COAST_CITIES)
            for (const cityId of WEST_COAST_CITIES) {
                expect(cityById(cityId).startColours).toContain('railroad.purple')
            }
        })

        it('puts the $5 bonus on four cities and the Chicago bonus on Chicago (R-4.3.1, R-4.3.2)', () => {
            expect(
                USA_CITIES.filter((city) => city.bonus === 'bonus.usa.five-dollar').map(
                    (city) => city.id
                )
            ).toEqual(FIVE_DOLLAR_CITIES)
            expect(
                USA_CITIES.filter((city) => city.bonus === 'bonus.usa.chicago').map(
                    (city) => city.id
                )
            ).toEqual(['city.usa.chicago'])
        })
    })

    describe('integrity', () => {
        it('puts every city on a city hex that names it', () => {
            for (const city of USA_CITIES) {
                expect(hexById(city.hexId)).toMatchObject({ terrain: 'city', cityId: city.id })
            }
        })

        it('names exactly one city on every city hex', () => {
            for (const hex of USA_HEXES) {
                if (hex.terrain === 'city') {
                    expect(USA_CITIES.filter((city) => city.hexId === hex.id)).toEqual([
                        cityById(hex.cityId)
                    ])
                }
            }
        })

        it('gives every hex id a dcol with the parity of its row', () => {
            for (const hex of USA_HEXES) {
                expect(hexCoordinates(hex.id)).toEqual({ row: hex.row, dcol: hex.dcol })
                expect(Math.abs(hex.dcol - hex.row) % 2).toBe(0)
            }
        })
    })

    describe('adjacency (R-4.1.2, rules-interpretations.md, Ids and coordinates)', () => {
        it('returns only hexes that exist', () => {
            for (const hex of USA_HEXES) {
                expect(adjacentHexIds(hex.id).every(isHexId)).toBe(true)
            }
        })

        it('is symmetric', () => {
            for (const hex of USA_HEXES) {
                for (const adjacentId of adjacentHexIds(hex.id)) {
                    expect(adjacentHexIds(adjacentId)).toContain(hex.id)
                }
            }
        })

        it('follows the doubled-column formula (r, d±2), (r±1, d±1)', () => {
            expect([...adjacentHexIds('hex.usa.8-32')].sort()).toEqual(
                [
                    'hex.usa.7-31',
                    'hex.usa.7-33',
                    'hex.usa.8-30',
                    'hex.usa.8-34',
                    'hex.usa.9-31',
                    'hex.usa.9-33'
                ].sort()
            )
        })

        it('drops the hexes off the board', () => {
            expect([...adjacentHexIds('hex.usa.5-43')].sort()).toEqual(
                [
                    'hex.usa.4-42',
                    'hex.usa.5-41',
                    'hex.usa.5-45',
                    'hex.usa.6-42',
                    'hex.usa.6-44'
                ].sort()
            )
            expect([...adjacentHexIds('hex.usa.0-4')].sort()).toEqual(
                ['hex.usa.0-6', 'hex.usa.1-3', 'hex.usa.1-5'].sort()
            )
            expect([...adjacentHexIds('hex.usa.18-50')].sort()).toEqual(
                ['hex.usa.17-49', 'hex.usa.17-51'].sort()
            )
        })
    })
})
