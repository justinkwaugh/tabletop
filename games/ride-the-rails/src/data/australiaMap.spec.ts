import { HexOrientation } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AUSTRALIA_CITIES, AUSTRALIA_HEXES, AUSTRALIA_MAP } from './australiaMap.js'
import type { City, CityId } from './boardMap.js'
import { adjacentHexIds, boardMap, cityById, hexById, isHexId } from './boardMaps.js'
import { flatHexCoordinates, type HexId } from './hexes.js'

// The printed board's cities in reading order: name, hex (col-drow), start colours, capacity,
// bonus.
const PRINTED_CITIES: readonly (readonly [string, string, string, string, string])[] = [
    ['Broken Hill', '11-1', 'Purple, Black', '2', '—'],
    ['Menindee', '13-3', 'Purple, Black', '2', '—'],
    ['Peterborough', '6-6', 'Purple, Black', '2', '—'],
    ['Ivanhoe', '16-6', 'Purple, Black', '2', '—'],
    ['Dubbo', '26-6', 'Purple, Black', '2', '—'],
    ['Brisbane', '34-6', '—', '1', 'bonus.au.brisbane'],
    ['Roto', '19-7', 'Purple, Black', '2', '—'],
    ['Mudgee', '29-7', 'Purple, Black', '2', '—'],
    ['Muswellbrook', '31-7', 'Purple, Black', '2', '—'],
    ['Condobolin', '22-8', 'Purple, Black', '2', '—'],
    ['Parkes', '25-9', 'Purple, Black', '2', '—'],
    ['Newcastle', '33-9', 'Purple, Black', '2', '—'],
    ['Orange', '27-11', 'Purple, Black', '2', '—'],
    ['Lithgow', '29-11', 'Purple, Black', '2', '—'],
    ['Perth', '0-12', '—', '1', 'bonus.au.perth'],
    ['Mildura', '12-12', 'Purple, Black', '2', '—'],
    ['Griffith', '20-12', 'Purple, Black', '2', '—'],
    ['Wyalongo', '23-13', 'Purple, Black', '2', '—'],
    ['Adelaide', '4-14', 'Orange, Purple, Black', '2', '—'],
    ['Loxton', '8-14', 'Purple, Black', '2', '—'],
    ['Benanee', '14-14', 'Purple, Black', '2', '—'],
    ['Hay', '18-14', 'Purple, Black', '2', '—'],
    ['Cowra', '26-14', 'Purple, Black', '2', '—'],
    ['Narrandera', '21-15', 'Purple, Black', '2', '—'],
    ['Sydney', '31-15', 'Red, Purple, Black', '2', '—'],
    ['Murray Bridge', '6-16', 'Purple, Black', '2', '—'],
    ['Cootamundra', '24-16', 'Purple, Black', '2', '—'],
    ['Goulburn', '28-16', 'Purple, Black', '2', '—'],
    ['Pinaroo', '9-17', 'Purple, Black', '2', '—'],
    ['Patchewollock', '11-17', 'Purple, Black', '2', '—'],
    ['Swan Hill', '14-18', 'Purple, Black', '2', '—'],
    ['Deniliquin', '18-18', 'Purple, Black', '2', '—'],
    ['Wagga Wagga', '22-18', 'Yellow, Black', '2', '—'],
    ['Yaapeet', '12-20', 'Purple, Black', '2', '—'],
    ['Canberra', '26-20', 'Purple, Black', '2', '—'],
    ['Bordertown', '9-21', 'Purple, Black', '2', '—'],
    ['Echuca', '17-21', 'Purple, Black', '2', '—'],
    ['St. Arnaud', '14-22', 'Purple, Black', '2', '—'],
    ['Albury', '22-22', 'Purple, Black', '2', '—'],
    ['Kingston', '7-23', 'Purple, Black', '2', '—'],
    ['Bendigo', '16-24', 'Purple, Black', '2', '—'],
    ['Wangaratta', '20-24', 'Purple, Black', '2', '—'],
    ['Bombala', '26-24', 'Purple, Black', '2', '—'],
    ['Morea', '9-25', 'Purple, Black', '2', '—'],
    ['Ararat', '12-26', 'Purple, Black', '2', '—'],
    ['Ballarat', '15-27', 'Purple, Black', '2', '—'],
    ['Mount Gambier', '8-28', 'Purple, Black', '2', '—'],
    ['Melbourne', '17-29', 'Blue, Purple, Black', '2', '—'],
    ['Bairnsdale', '22-30', 'Purple, Black', '2', '—'],
    ['Orbost', '24-30', 'Purple, Black', '2', '—'],
    ['Warrnambool', '11-31', 'Purple, Black', '2', '—'],
    ['Geelong', '15-31', 'Purple, Black', '2', '—'],
    ['Wonthaggi', '18-32', 'Purple, Black', '2', '—'],
    ['Port Albert', '20-34', 'Purple, Black', '2', '—']
]

// R-1.1: the box holds 52 passengers.
const BOX_PASSENGERS = 52

const PERTH: CityId = 'city.au.perth'
const BRISBANE: CityId = 'city.au.brisbane'
const ADELAIDE: CityId = 'city.au.adelaide'
const NEWCASTLE: CityId = 'city.au.newcastle'

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
    return AUSTRALIA_HEXES.filter((hex) => hex.terrain === terrain).length
}

function neighbours(hexId: HexId): HexId[] {
    return [...adjacentHexIds(hexId)].sort()
}

describe('Australia map (R-8.2)', () => {
    describe('counts (the printed board’s totals)', () => {
        it('has 392 hexes: 286 plain, 34 mountain, 14 Alps, 4 long-distance, 54 cities', () => {
            expect(AUSTRALIA_HEXES).toHaveLength(392)
            expect(terrainCount('plain')).toBe(286)
            expect(terrainCount('mountain')).toBe(34)
            expect(terrainCount('alps')).toBe(14)
            expect(terrainCount('long-distance')).toBe(4)
            expect(terrainCount('city')).toBe(54)
            expect(AUSTRALIA_CITIES).toHaveLength(54)
        })

        it('gives every hex and every city a unique id', () => {
            expect(new Set(AUSTRALIA_HEXES.map((hex) => hex.id)).size).toBe(AUSTRALIA_HEXES.length)
            expect(new Set(AUSTRALIA_CITIES.map((city) => city.id)).size).toBe(
                AUSTRALIA_CITIES.length
            )
        })
    })

    describe('the printed city table (the printed board)', () => {
        it('matches every row of the city table', () => {
            expect(AUSTRALIA_CITIES.map(printedCity)).toEqual(PRINTED_CITIES)
        })

        it('names each city in kebab case in the au group, the printed spellings kept', () => {
            for (const city of AUSTRALIA_CITIES) {
                expect(city.id).toMatch(/^city\.au\.[a-z]+(-[a-z]+)*$/)
            }
            expect(cityById('city.au.pinaroo').name).toBe('Pinaroo')
            expect(cityById('city.au.wyalongo').name).toBe('Wyalongo')
            expect(cityById('city.au.st-arnaud').name).toBe('St. Arnaud')
        })

        it('prints Black on every city but Perth and Brisbane, and Purple on all of them but Wagga Wagga', () => {
            const without = (railroadId: string) =>
                AUSTRALIA_CITIES.filter(
                    (city) => !city.startColours.some((colour) => colour === railroadId)
                ).map((city) => city.id)
            expect(without('railroad.black')).toEqual([BRISBANE, PERTH])
            expect(without('railroad.purple')).toEqual([BRISBANE, PERTH, 'city.au.wagga-wagga'])
        })

        it('belongs to no group: the map has no coasts the rules name', () => {
            expect(AUSTRALIA_CITIES.every((city) => city.groups.length === 0)).toBe(true)
        })
    })

    describe('integrity', () => {
        it('is the flat map map.au, in the registry', () => {
            expect(AUSTRALIA_MAP).toMatchObject({
                id: 'map.au',
                key: 'au',
                orientation: HexOrientation.Flat
            })
            expect(boardMap('map.au').hexes.map((hex) => hex.id)).toEqual(
                AUSTRALIA_HEXES.map((hex) => hex.id)
            )
        })

        it('puts every city on a city hex that names it', () => {
            for (const city of AUSTRALIA_CITIES) {
                expect(hexById(city.hexId)).toMatchObject({ terrain: 'city', cityId: city.id })
            }
        })

        it('gives every hex id a drow with the parity of its column, from column 0 and drow 1', () => {
            const coordinates = AUSTRALIA_HEXES.map((hex) => flatHexCoordinates(hex.id))
            for (const { col, drow } of coordinates) {
                expect(Math.abs(drow - col) % 2).toBe(0)
            }
            expect(Math.min(...coordinates.map(({ col }) => col))).toBe(0)
            expect(Math.min(...coordinates.map(({ drow }) => drow))).toBe(1)
        })
    })

    describe('adjacency (R-4.1.2, rules-interpretations.md, Ids and coordinates)', () => {
        it('returns only hexes that exist', () => {
            for (const hex of AUSTRALIA_HEXES) {
                expect(adjacentHexIds(hex.id).every(isHexId)).toBe(true)
            }
        })

        it('is symmetric', () => {
            for (const hex of AUSTRALIA_HEXES) {
                for (const adjacentId of adjacentHexIds(hex.id)) {
                    expect(adjacentHexIds(adjacentId)).toContain(hex.id)
                }
            }
        })

        it('follows the flat formula (c, d±2), (c±1, d±1)', () => {
            expect(neighbours('hex.au.6-8')).toEqual(
                [
                    'hex.au.6-6',
                    'hex.au.6-10',
                    'hex.au.5-7',
                    'hex.au.5-9',
                    'hex.au.7-7',
                    'hex.au.7-9'
                ].sort()
            )
        })

        it('has no impassable side', () => {
            expect(AUSTRALIA_MAP.impassable).toEqual([])
        })
    })

    describe('the long-distance chains (R-8.2)', () => {
        const perth = cityById(PERTH).hexId
        const adelaide = cityById(ADELAIDE).hexId
        const brisbane = cityById(BRISBANE).hexId
        const newcastle = cityById(NEWCASTLE).hexId

        it('runs from Perth through three long-distance hexes to Adelaide, and nowhere else', () => {
            const chain: HexId[] = [perth, 'hex.au.1-13', 'hex.au.2-12', 'hex.au.3-13', adelaide]
            for (const hexId of chain.slice(1, -1)) {
                expect(hexById(hexId).terrain).toBe('long-distance')
            }
            expect(neighbours(perth)).toEqual(['hex.au.1-13'])
            for (const [index, hexId] of chain.entries()) {
                if (index > 0 && index < chain.length - 1) {
                    expect(neighbours(hexId)).toEqual([chain[index - 1], chain[index + 1]].sort())
                }
            }
            expect(neighbours(adelaide)).toContain('hex.au.3-13')
        })

        it('runs from Newcastle through one long-distance hex to Brisbane, and nowhere else', () => {
            expect(hexById('hex.au.34-8').terrain).toBe('long-distance')
            expect(neighbours(brisbane)).toEqual(['hex.au.34-8'])
            expect(neighbours('hex.au.34-8')).toEqual([brisbane, newcastle].sort())
        })

        it('has no other long-distance hex', () => {
            expect(
                AUSTRALIA_HEXES.filter((hex) => hex.terrain === 'long-distance').map(
                    (hex) => hex.id
                )
            ).toEqual(['hex.au.34-8', 'hex.au.2-12', 'hex.au.1-13', 'hex.au.3-13'])
        })

        it('marks Perth and Brisbane, which close the chains, as its long-distance cities, and no other map any', () => {
            expect(boardMap('map.au').longDistanceCities).toEqual([PERTH, BRISBANE])
            for (const mapId of ['map.usa', 'map.ca', 'map.fr', 'map.de'] as const) {
                expect(boardMap(mapId).longDistanceCities, mapId).toEqual([])
            }
        })

        it('takes the four long-distance hexes, Perth and Brisbane as long-distance, and nothing else', () => {
            const map = boardMap('map.au')
            expect(
                AUSTRALIA_HEXES.filter((hex) => map.isLongDistance(hex.id))
                    .map((hex) => hex.id)
                    .sort()
            ).toEqual(
                [perth, brisbane, 'hex.au.34-8', 'hex.au.2-12', 'hex.au.1-13', 'hex.au.3-13'].sort()
            )
        })

        it('prints no start colour in a long-distance city', () => {
            expect(cityById(PERTH).startColours).toEqual([])
            expect(cityById(BRISBANE).startColours).toEqual([])
        })
    })

    describe('capacity (R-4.1.4, R-8.2)', () => {
        it('holds no locomotive in the Alps, one in a long-distance hex, Perth and Brisbane, two elsewhere', () => {
            const map = boardMap('map.au')
            for (const hex of AUSTRALIA_HEXES) {
                const city = map.cityIn(hex.id)
                const expected =
                    hex.terrain === 'alps'
                        ? 0
                        : hex.terrain === 'long-distance' ||
                            city?.id === PERTH ||
                            city?.id === BRISBANE
                          ? 1
                          : 2
                expect([hex.id, map.capacity(hex.id)]).toEqual([hex.id, expected])
            }
        })
    })

    describe('passengers (R-1.3.2, R-8.2)', () => {
        it('takes one at setup in every city but Perth and Brisbane: 52, the box’s 52', () => {
            const cityIds = boardMap('map.au').setupPassengerCityIds()
            expect(cityIds).toHaveLength(52)
            expect(cityIds.length).toBeLessThanOrEqual(BOX_PASSENGERS)
            expect(cityIds).toEqual(
                AUSTRALIA_CITIES.map((city) => city.id).filter(
                    (cityId) => cityId !== PERTH && cityId !== BRISBANE
                )
            )
        })
    })
})
