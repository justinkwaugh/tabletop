import { describe, expect, it } from 'vitest'
import { assertExists, CardinalDirection, type OffsetCoordinates } from '@tabletop/common'
import {
    BoardCellType,
    BoardColumns,
    BoardRows,
    cellAt,
    EntranceFountainIds,
    Fountains,
    fountainsNextToShop,
    getFountain,
    getShop,
    routeFrom,
    routesFrom,
    Shops,
    shopsNextTo,
    type FountainId,
    type ShopId
} from './board.js'
import { MarketColor } from '../definition/marketColor.js'

type ExpectedRoute = [FountainId, CardinalDirection, FountainId, number, ShopId[]]

// Mirrors the route table in docs/marracash-board-map.md.
const ExpectedRoutes: ExpectedRoute[] = [
    [1, CardinalDirection.East, 2, 3, ['G2']],
    [1, CardinalDirection.South, 6, 3, ['G2', 'P2', 'R2', 'B3']],
    [1, CardinalDirection.West, 3, 4, ['P2', 'B1', 'R1']],
    [2, CardinalDirection.South, 7, 4, ['G2', 'R2', 'P4']],
    [2, CardinalDirection.West, 1, 3, ['G2']],
    [3, CardinalDirection.North, 1, 4, ['R1', 'B1', 'P2']],
    [3, CardinalDirection.South, 5, 2, ['B1', 'P3']],
    [3, CardinalDirection.West, 4, 5, ['P3', 'R1', 'Y2', 'G1', 'P1']],
    [4, CardinalDirection.North, 3, 5, ['G1', 'P1', 'Y2', 'R1', 'P3', 'B1']],
    [4, CardinalDirection.South, 9, 3, ['B2', 'R3', 'B4']],
    [4, CardinalDirection.West, 8, 5, ['B2', 'P1', 'Y1']],
    [5, CardinalDirection.North, 3, 2, ['B1', 'P3']],
    [5, CardinalDirection.East, 6, 3, ['B1', 'G3', 'B3', 'P2']],
    [5, CardinalDirection.South, 11, 2, ['G3', 'Y3']],
    [6, CardinalDirection.North, 1, 3, ['P2', 'R2', 'G2']],
    [6, CardinalDirection.East, 7, 2, ['R2', 'Y4']],
    [6, CardinalDirection.West, 5, 3, ['B3', 'P2', 'B1', 'G3', 'P3']],
    [7, CardinalDirection.East, 2, 4, ['P4', 'R2', 'G2']],
    [7, CardinalDirection.South, 13, 3, ['P4', 'Y4']],
    [7, CardinalDirection.West, 6, 2, ['R2', 'Y4', 'B3']],
    [8, CardinalDirection.North, 4, 5, ['B2', 'Y1', 'P1', 'Y2']],
    [8, CardinalDirection.East, 9, 2, ['B2', 'G4', 'B4']],
    [8, CardinalDirection.South, 14, 3, ['G4']],
    [9, CardinalDirection.North, 4, 3, ['B2', 'R3', 'Y2']],
    [9, CardinalDirection.East, 10, 2, ['B4', 'R3', 'Y3']],
    [9, CardinalDirection.West, 8, 2, ['B2', 'G4']],
    [10, CardinalDirection.East, 11, 2, ['R5', 'Y3', 'G3']],
    [10, CardinalDirection.South, 15, 3, ['B4', 'R5', 'Y5']],
    [10, CardinalDirection.West, 9, 2, ['B4', 'R3']],
    [11, CardinalDirection.North, 5, 2, ['G3', 'Y3', 'P3']],
    [11, CardinalDirection.South, 12, 3, ['P5', 'R5', 'G3', 'R4']],
    [11, CardinalDirection.West, 10, 2, ['R5', 'Y3']],
    [12, CardinalDirection.East, 13, 3, ['B5', 'R4', 'Y4']],
    [12, CardinalDirection.South, 16, 2, ['B5', 'P5']],
    [12, CardinalDirection.West, 11, 3, ['G3', 'P5', 'R5']],
    [13, CardinalDirection.North, 7, 3, ['P4', 'Y4', 'R2']],
    [13, CardinalDirection.South, 16, 5, ['B5', 'G5']],
    [13, CardinalDirection.West, 12, 3, ['B5', 'Y4', 'R4']],
    [14, CardinalDirection.North, 8, 3, ['G4']],
    [14, CardinalDirection.East, 15, 4, ['G4', 'Y5']],
    [15, CardinalDirection.North, 10, 3, ['R5', 'Y5', 'B4', 'Y3']],
    [15, CardinalDirection.East, 16, 4, ['R5', 'P5']],
    [15, CardinalDirection.West, 14, 4, ['Y5', 'G4']],
    [16, CardinalDirection.North, 12, 2, ['B5', 'P5', 'R4']],
    [16, CardinalDirection.East, 13, 5, ['B5', 'G5']],
    [16, CardinalDirection.West, 15, 4, ['P5', 'R5']]
]

const allRoutes = Fountains.flatMap((fountain) => routesFrom(fountain.id))

function key(coords: OffsetCoordinates): string {
    return `${coords.row},${coords.col}`
}

describe('MarraCash board', () => {
    it('has 25 shops, 5 of each colour', () => {
        expect(Shops).toHaveLength(25)
        for (const color of Object.values(MarketColor)) {
            expect(Shops.filter((shop) => shop.color === color)).toHaveLength(5)
        }
    })

    it('has 16 fountains, 3 of them entrances', () => {
        expect(Fountains).toHaveLength(16)
        expect(EntranceFountainIds).toEqual([1, 8, 16])
    })

    it('derives exactly the routes in the board map', () => {
        const actual = allRoutes.map((route) => [
            route.from,
            route.direction,
            route.to,
            route.path.length,
            route.shopsPassed
        ])
        expect(actual).toEqual(ExpectedRoutes)
    })

    it('makes every route work the same in reverse', () => {
        for (const route of allRoutes) {
            const reverse = routesFrom(route.to).find((candidate) => candidate.to === route.from)
            assertExists(reverse, `no route back from ${route.to} to ${route.from}`)
            const forwardCells = [getFountain(route.from).coords, ...route.path]
            const reverseCells = [getFountain(route.to).coords, ...reverse.path]
            expect(reverseCells.map(key)).toEqual(forwardCells.map(key).reverse())
        }
    })

    it('puts every walkway cell on at least one route', () => {
        const onRoute = new Set(allRoutes.flatMap((route) => route.path.map(key)))
        for (let row = 0; row < BoardRows; row++) {
            for (let col = 0; col < BoardColumns; col++) {
                if (cellAt({ row, col })?.type === BoardCellType.Walkway) {
                    expect(onRoute.has(key({ row, col })), `walkway ${row},${col}`).toBe(true)
                }
            }
        }
    })

    it('never puts two shops of one colour next to the same route cell', () => {
        for (const route of allRoutes) {
            for (const step of route.path) {
                const colors = shopsNextTo(step).map((shopId) => getShop(shopId).color)
                expect(new Set(colors).size).toBe(colors.length)
            }
        }
    })

    it('gives each entrance three exits and no neighbouring shop', () => {
        for (const fountainId of EntranceFountainIds) {
            expect(routesFrom(fountainId)).toHaveLength(3)
            expect(shopsNextTo(getFountain(fountainId).coords)).toEqual([])
        }
    })

    it('finds the fountains next to each shop for the auction pull-in', () => {
        const pullIns = Shops.flatMap((shop) =>
            fountainsNextToShop(shop.id).map((fountainId) => [shop.id, fountainId])
        )
        expect(pullIns).toEqual([
            ['B1', 3],
            ['Y2', 4],
            ['P3', 5],
            ['R2', 7],
            ['Y3', 10],
            ['G3', 11],
            ['B3', 6],
            ['R4', 12],
            ['B4', 9]
        ])
    })

    it('has no route in a blocked direction', () => {
        expect(routeFrom(2, CardinalDirection.North)).toBeUndefined()
        expect(routeFrom(4, CardinalDirection.East)).toBeUndefined()
    })
})
