import { HexOrientation } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    ALPHA_HEX,
    ALPS_HEX,
    BETA_HEX,
    FLAT_FIXTURE_DEFINITION,
    FLAT_FIXTURE_MAP,
    GAMMA_HEX,
    LONG_DISTANCE_HEX,
    MOUNTAIN_HEX
} from '../testing/flatFixtureMap.js'
import { BoardMap } from './boardMap.js'
import {
    BOARD_MAPS,
    adjacentHexIds,
    boardMap,
    cityById,
    hexById,
    hexCapacity,
    hexOrder,
    isHexId,
    mapIdOfHex
} from './boardMaps.js'
import {
    axialToFlat,
    compareReadingOrder,
    flatHexCoordinates,
    flatNeighbours,
    flatToAxial,
    hexIdToAxial,
    type HexId
} from './hexes.js'
import { MAP_IDS } from './maps.js'
import { USA_CITIES, USA_HEXES } from './usaMap.js'

const sorted = (hexIds: readonly HexId[]) => [...hexIds].sort()

describe('flat hex coordinates (R-4.1.2, R-8)', () => {
    it('names the neighbours of (c, d) as (c, d±2) and (c±1, d±1)', () => {
        const neighbours = flatNeighbours({ col: 5, drow: 7 })
        expect(neighbours.map(({ col, drow }) => `${col}-${drow}`).sort()).toEqual(
            ['5-5', '5-9', '4-6', '4-8', '6-6', '6-8'].sort()
        )
    })

    it('keeps col and drow of one parity, the cell grid a flat map is printed on', () => {
        for (const { col, drow } of flatNeighbours({ col: 4, drow: 10 })) {
            expect((col + drow) % 2).toBe(0)
        }
        for (const hex of FLAT_FIXTURE_MAP.hexes) {
            const { col, drow } = flatHexCoordinates(hex.id)
            expect((col + drow) % 2).toBe(0)
        }
    })

    it('reads axial q as the column and r as (drow - col) / 2, both ways', () => {
        expect(flatToAxial({ col: 3, drow: 7 })).toEqual({ q: 3, r: 2 })
        expect(axialToFlat({ q: 3, r: 2 })).toEqual({ col: 3, drow: 7 })
        expect(hexIdToAxial(HexOrientation.Flat, 'hex.usa.3-7')).toEqual({ q: 3, r: 2 })
        expect(hexIdToAxial(HexOrientation.Pointy, 'hex.usa.2-7')).toEqual({ q: 2.5, r: 2 })
    })

    it('reads a flat map in doubled rows north to south, each west to east', () => {
        expect(compareReadingOrder(HexOrientation.Flat, 'hex.usa.3-1', 'hex.usa.0-2')).toBeLessThan(
            0
        )
        expect(compareReadingOrder(HexOrientation.Flat, 'hex.usa.0-2', 'hex.usa.2-2')).toBeLessThan(
            0
        )
        expect(
            compareReadingOrder(HexOrientation.Pointy, 'hex.usa.0-30', 'hex.usa.1-1')
        ).toBeLessThan(0)
    })
})

describe('a flat map (the fixture, R-8)', () => {
    it('lists its hexes in reading order, whatever order the definition gives', () => {
        expect(FLAT_FIXTURE_MAP.hexes.map((hex) => hex.id)).toEqual([
            'hex.usa.0-0',
            'hex.usa.2-0',
            'hex.usa.1-1',
            'hex.usa.3-1',
            'hex.usa.0-2',
            'hex.usa.2-2',
            'hex.usa.1-3',
            'hex.usa.3-3',
            'hex.usa.0-4',
            'hex.usa.2-4',
            'hex.usa.1-5',
            'hex.usa.3-5',
            'hex.usa.0-6',
            'hex.usa.1-7',
            'hex.usa.3-7'
        ])
        expect(FLAT_FIXTURE_MAP.hexOrder('hex.usa.2-0')).toBe(1)
        expect(FLAT_FIXTURE_MAP.hexOrder('hex.usa.3-7')).toBe(14)
    })

    it('makes a hex adjacent to the six around it that are on the board', () => {
        expect(sorted(FLAT_FIXTURE_MAP.adjacentHexIds(ALPS_HEX))).toEqual(
            sorted([
                MOUNTAIN_HEX,
                'hex.usa.2-2',
                GAMMA_HEX,
                LONG_DISTANCE_HEX,
                'hex.usa.0-4',
                ALPHA_HEX
            ])
        )
        expect(sorted(FLAT_FIXTURE_MAP.adjacentHexIds('hex.usa.0-0'))).toEqual(
            sorted([ALPHA_HEX, MOUNTAIN_HEX])
        )
    })

    it('leaves out of adjacency the two hexes an impassable side parts, both ways (R-8)', () => {
        expect(FLAT_FIXTURE_MAP.adjacentHexIds('hex.usa.0-4')).not.toContain(LONG_DISTANCE_HEX)
        expect(FLAT_FIXTURE_MAP.adjacentHexIds(LONG_DISTANCE_HEX)).not.toContain('hex.usa.0-4')
        expect(sorted(FLAT_FIXTURE_MAP.adjacentHexIds('hex.usa.0-4'))).toEqual(
            sorted([ALPHA_HEX, ALPS_HEX, 'hex.usa.0-6'])
        )
        expect(sorted(FLAT_FIXTURE_MAP.adjacentHexIds(LONG_DISTANCE_HEX))).toEqual(
            sorted([ALPS_HEX, GAMMA_HEX, 'hex.usa.0-6', 'hex.usa.1-7'])
        )
    })

    it('keeps the printed impassable sides as the map lists them, for the board to draw (R-8)', () => {
        expect(FLAT_FIXTURE_MAP.impassable).toEqual(FLAT_FIXTURE_DEFINITION.impassable)
        expect(FLAT_FIXTURE_MAP.impassable.length).toBeGreaterThan(0)
    })

    it('gives a two-cell hex the neighbours of both its cells, once each, and never itself', () => {
        expect(FLAT_FIXTURE_MAP.cellsOf(GAMMA_HEX)).toEqual([
            { q: 2, r: 1 },
            { q: 2, r: 2 }
        ])
        const neighbours = FLAT_FIXTURE_MAP.adjacentHexIds(GAMMA_HEX)
        expect(sorted(neighbours)).toEqual(
            sorted([
                'hex.usa.2-2',
                BETA_HEX,
                'hex.usa.3-5',
                LONG_DISTANCE_HEX,
                ALPS_HEX,
                'hex.usa.3-7',
                'hex.usa.1-7'
            ])
        )
        expect(new Set(neighbours).size).toBe(neighbours.length)
        expect(FLAT_FIXTURE_MAP.adjacentHexIds('hex.usa.1-7')).toContain(GAMMA_HEX)
        expect(FLAT_FIXTURE_MAP.adjacentHexIds('hex.usa.3-7')).toContain(GAMMA_HEX)
        expect(FLAT_FIXTURE_MAP.hasHex('hex.usa.2-6')).toBe(false)
    })

    it('makes adjacency symmetric', () => {
        for (const hex of FLAT_FIXTURE_MAP.hexes) {
            for (const other of FLAT_FIXTURE_MAP.adjacentHexIds(hex.id)) {
                expect(FLAT_FIXTURE_MAP.adjacentHexIds(other)).toContain(hex.id)
            }
        }
    })

    it('derives capacity from the hex: a city its own, the Alps none, long-distance one, else two (R-4.1.4, R-8)', () => {
        expect(FLAT_FIXTURE_MAP.capacity(ALPHA_HEX)).toBe(2)
        expect(FLAT_FIXTURE_MAP.capacity(BETA_HEX)).toBe(1)
        expect(FLAT_FIXTURE_MAP.capacity(GAMMA_HEX)).toBe('unlimited')
        expect(FLAT_FIXTURE_MAP.capacity(ALPS_HEX)).toBe(0)
        expect(FLAT_FIXTURE_MAP.capacity(LONG_DISTANCE_HEX)).toBe(1)
        expect(FLAT_FIXTURE_MAP.capacity(MOUNTAIN_HEX)).toBe(2)
        expect(FLAT_FIXTURE_MAP.capacity('hex.usa.0-0')).toBe(2)
    })

    it('takes a long-distance hex and a long-distance city as long-distance, and nothing else (R-8)', () => {
        expect(FLAT_FIXTURE_MAP.isLongDistance(LONG_DISTANCE_HEX)).toBe(true)
        expect(FLAT_FIXTURE_MAP.isLongDistance(BETA_HEX)).toBe(false)
        expect(FLAT_FIXTURE_MAP.isLongDistance('hex.usa.0-0')).toBe(false)
        const beta = new BoardMap({
            ...FLAT_FIXTURE_DEFINITION,
            longDistanceCities: ['city.usa.beta']
        })
        expect(beta.isLongDistance(BETA_HEX)).toBe(true)
        expect(beta.isLongDistance(ALPHA_HEX)).toBe(false)
        expect(beta.isLongDistance(LONG_DISTANCE_HEX)).toBe(true)
    })

    it('refuses a long-distance city the map does not have', () => {
        expect(
            () =>
                new BoardMap({ ...FLAT_FIXTURE_DEFINITION, longDistanceCities: ['city.usa.delta'] })
        ).toThrow(/not on/)
    })

    it('finds a city by its hex, and none in a terrain hex', () => {
        expect(FLAT_FIXTURE_MAP.cityIn(GAMMA_HEX)?.name).toBe('Gamma')
        expect(FLAT_FIXTURE_MAP.cityIn(MOUNTAIN_HEX)).toBeUndefined()
    })

    it('refuses a definition where two hexes cover one cell', () => {
        expect(
            () =>
                new BoardMap({
                    ...FLAT_FIXTURE_DEFINITION,
                    hexes: [
                        ...FLAT_FIXTURE_DEFINITION.hexes,
                        { id: 'hex.usa.2-6', terrain: 'plain' }
                    ]
                })
        ).toThrow(/cover/)
    })

    it('refuses an impassable side between hexes that share none', () => {
        expect(
            () =>
                new BoardMap({
                    ...FLAT_FIXTURE_DEFINITION,
                    impassable: [['hex.usa.0-0', 'hex.usa.3-7']]
                })
        ).toThrow(/share no side/)
    })

    it('accepts a printed side along the board’s edge, between a hex and a cell off it, which parts nothing (R-8)', () => {
        const edged = new BoardMap({
            ...FLAT_FIXTURE_DEFINITION,
            impassable: [...FLAT_FIXTURE_DEFINITION.impassable, ['hex.usa.3-1', 'hex.usa.4-2']]
        })
        expect(edged.adjacentHexIds('hex.usa.3-1')).toEqual(
            FLAT_FIXTURE_MAP.adjacentHexIds('hex.usa.3-1')
        )
    })

    it('refuses an impassable side between two cells off the board', () => {
        expect(
            () =>
                new BoardMap({
                    ...FLAT_FIXTURE_DEFINITION,
                    impassable: [['hex.usa.5-1', 'hex.usa.5-3']]
                })
        ).toThrow(/off/)
    })

    it('refuses a city without its city hex', () => {
        expect(
            () =>
                new BoardMap({
                    ...FLAT_FIXTURE_DEFINITION,
                    hexes: FLAT_FIXTURE_DEFINITION.hexes.filter((hex) => hex.id !== BETA_HEX)
                })
        ).toThrow(/not in a city hex/)
    })
})

describe('the map registry (R-8)', () => {
    it('holds one board for every map id', () => {
        expect(Object.keys(BOARD_MAPS)).toEqual([...MAP_IDS])
        for (const mapId of MAP_IDS) {
            expect(boardMap(mapId).id).toBe(mapId)
        }
    })

    it('reads the USA as a pointy map, its hexes and cities those of the USA table', () => {
        const usa = boardMap('map.usa')
        expect(usa.orientation).toBe(HexOrientation.Pointy)
        expect(usa.hexes.map((hex) => hex.id)).toEqual(USA_HEXES.map((hex) => hex.id))
        expect(usa.cities).toEqual(USA_CITIES)
        expect(usa.citiesWithoutSetupPassenger).toEqual([])
    })

    it('looks a hex or city up by its id alone, the id naming its map', () => {
        expect(isHexId('hex.usa.5-43')).toBe(true)
        expect(isHexId('hex.usa.5-44')).toBe(false)
        expect(isHexId('hex.au.0-12')).toBe(true)
        expect(isHexId('hex.au.0-10')).toBe(false)
        expect(cityById('city.au.perth').hexId).toBe('hex.au.0-12')
        expect(hexCapacity('hex.au.0-12')).toBe(1)
        expect(hexById('hex.usa.5-43')).toMatchObject({
            terrain: 'city',
            cityId: 'city.usa.chicago'
        })
        expect(cityById('city.usa.chicago').hexId).toBe('hex.usa.5-43')
        expect(hexCapacity('hex.usa.5-43')).toBe('unlimited')
        expect(hexOrder(USA_HEXES[3].id)).toBe(3)
        expect(adjacentHexIds('hex.usa.5-43')).toEqual(
            boardMap('map.usa').adjacentHexIds('hex.usa.5-43')
        )
    })

    it('names the map a hex id belongs to', () => {
        for (const mapId of MAP_IDS) {
            for (const hex of boardMap(mapId).hexes) {
                expect(mapIdOfHex(hex.id)).toBe(mapId)
            }
        }
    })
})
