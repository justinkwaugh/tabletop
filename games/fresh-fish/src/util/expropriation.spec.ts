import { coordinatesToNumber, offsetToOffsetTuple } from '@tabletop/common'
import { Cell, CellType } from '../components/cells.js'
import { describe, expect, it } from 'vitest'
import { HydratedGameBoard } from '../components/gameBoard.js'
import { Expropriator } from './expropriation.js'
import { logBoard } from './stateLogger.js'
import { GoodsType } from '../definition/goodsType.js'

describe('Fresh Fish Expropriation Tests', () => {
    it('expropriates correctly when supplying a test placement', () => {
        const cells: Cell[][] = [
            [{ type: CellType.Empty }, { type: CellType.Empty }, { type: CellType.Market }],
            [
                { type: CellType.Disk, playerId: 'foo' },
                { type: CellType.Disk, playerId: 'bar' },
                { type: CellType.Disk, playerId: 'baz' }
            ],
            [
                { type: CellType.Disk, playerId: 'qux' },
                { type: CellType.Empty },
                { type: CellType.Empty }
            ]
        ]

        const board = new HydratedGameBoard({
            cells
        })
        logBoard(board)
        const expropriator = new Expropriator(board)

        const result = expropriator.calculateExpropriation(offsetToOffsetTuple({ row: 1, col: 0 }))
        expect(result.expropriatedCoords).toHaveLength(3)
        const expropriatedIds = new Set(
            result.expropriatedCoords.map((coords) => coordinatesToNumber(coords))
        )
        expect(expropriatedIds.has(coordinatesToNumber({ row: 0, col: 1 }))).toBe(true)
        expect(expropriatedIds.has(coordinatesToNumber({ row: 1, col: 1 }))).toBe(true)
        expect(expropriatedIds.has(coordinatesToNumber({ row: 2, col: 1 }))).toBe(true)
        expect(result.returnedDisks).toEqual({ bar: 1 })

        const result2 = expropriator.calculateExpropriation(offsetToOffsetTuple({ row: 1, col: 1 }))
        expect(result2.expropriatedCoords).toHaveLength(5)
        const expropriatedIds2 = new Set(
            result2.expropriatedCoords.map((coords) => coordinatesToNumber(coords))
        )
        expect(expropriatedIds2.has(coordinatesToNumber({ row: 0, col: 0 }))).toBe(true)
        expect(expropriatedIds2.has(coordinatesToNumber({ row: 1, col: 0 }))).toBe(true)
        expect(expropriatedIds2.has(coordinatesToNumber({ row: 2, col: 0 }))).toBe(true)
        expect(expropriatedIds2.has(coordinatesToNumber({ row: 2, col: 1 }))).toBe(true)
        expect(expropriatedIds2.has(coordinatesToNumber({ row: 2, col: 2 }))).toBe(true)
        expect(result2.returnedDisks).toEqual({ foo: 1, qux: 1 })

        const result3 = expropriator.calculateExpropriation(offsetToOffsetTuple({ row: 1, col: 2 }))

        expect(result3.expropriatedCoords).toHaveLength(2)
        const expropriatedIds3 = new Set(
            result3.expropriatedCoords.map((coords) => coordinatesToNumber(coords))
        )
        expect(expropriatedIds3.has(coordinatesToNumber({ row: 0, col: 1 }))).toBe(true)
        expect(expropriatedIds3.has(coordinatesToNumber({ row: 2, col: 1 }))).toBe(true)
        console.log(result3)
        expect(result3.returnedDisks).toEqual({})

        const result4 = expropriator.calculateExpropriation(offsetToOffsetTuple({ row: 2, col: 0 }))
        expect(result4.expropriatedCoords).toHaveLength(1)
        const expropriatedIds4 = new Set(
            result4.expropriatedCoords.map((coords) => coordinatesToNumber(coords))
        )
        expect(expropriatedIds4.has(coordinatesToNumber({ row: 1, col: 1 }))).toBe(true)
        expect(result4.returnedDisks).toEqual({ bar: 1 })
    })

    it('expropriates correctly without a test placement', () => {
        const cells: Cell[][] = [
            [{ type: CellType.Empty }, { type: CellType.Empty }, { type: CellType.Empty }],
            [
                { type: CellType.Truck, goodsType: GoodsType.Cheese },
                { type: CellType.Empty },
                { type: CellType.Truck, goodsType: GoodsType.Fish }
            ],
            [{ type: CellType.Empty }, { type: CellType.Empty }, { type: CellType.Empty }]
        ]

        const board = new HydratedGameBoard({
            cells
        })
        logBoard(board)
        const expropriator = new Expropriator(board)

        const result = expropriator.calculateExpropriation()
        expect(result.expropriatedCoords).toHaveLength(3)
        const expropriatedIds = new Set(
            result.expropriatedCoords.map((coords) => coordinatesToNumber(coords))
        )
        expect(expropriatedIds.has(coordinatesToNumber({ row: 0, col: 1 }))).toBe(true)
        expect(expropriatedIds.has(coordinatesToNumber({ row: 1, col: 1 }))).toBe(true)
        expect(expropriatedIds.has(coordinatesToNumber({ row: 2, col: 1 }))).toBe(true)
        expect(result.returnedDisks).toEqual({})
    })
})
