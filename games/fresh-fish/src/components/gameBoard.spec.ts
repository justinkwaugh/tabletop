import { beforeEach, describe, expect, it } from 'vitest'
import { HydratedGameBoard } from '../components/gameBoard.js'
import { CellType } from './cells.js'
import { GoodsType } from '../definition/goodsType.js'

interface LocalTestContext {
    board: HydratedGameBoard
}

describe('Fresh Fish Game Board Tests', () => {
    beforeEach<LocalTestContext>(async (context) => {
        // extend context
        context.board = new HydratedGameBoard({
            cells: []
        })
    })

    it<LocalTestContext>('should be iterable', ({ board }) => {
        board.cells = [
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Market }],
            [
                { type: CellType.Truck, goodsType: GoodsType.Fish },
                { type: CellType.Disk, playerId: 'abc' },
                { type: CellType.Empty }
            ],
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Empty }]
        ]

        const boardCells = Array.from(board)
        expect(boardCells.length).toEqual(7)
    })

    it<LocalTestContext>('can find empty', ({ board }) => {
        board.cells = [
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Market }],
            [
                { type: CellType.Truck, goodsType: GoodsType.Fish },
                { type: CellType.Disk, playerId: 'abc' },
                { type: CellType.Empty }
            ],
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Empty }]
        ]

        expect(board.hasEmptyCell()).toBeTruthy()

        board.cells[0][1] = { type: CellType.Disk, playerId: 'def' }
        board.cells[1][2] = { type: CellType.Truck, goodsType: GoodsType.Cheese }
        board.cells[2][1] = { type: CellType.Road }
        board.cells[2][2] = { type: CellType.Market }

        expect(board.hasEmptyCell()).toBeFalsy()
    })
})
