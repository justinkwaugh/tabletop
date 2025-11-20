import { Cell, CellType } from '../components/cells.js'
import { describe, expect, it } from 'vitest'
import { HydratedGameBoard } from '../components/gameBoard.js'
import { logBoard } from './stateLogger.js'
import { GoodsType } from '../definition/goodsType.js'
import { generateTestState } from './testHelper.js'
import { Scorer } from './scoring.js'

describe('Fresh Fish Scoring Tests', () => {
    it('scores correctly', () => {
        const state = generateTestState({ numPlayers: 3 })
        const cells: Cell[][] = [
            [
                { type: CellType.Truck, goodsType: GoodsType.Fish },
                { type: CellType.Empty },
                { type: CellType.Market },
                { type: CellType.Stall, goodsType: GoodsType.Fish, playerId: 'p1' }
            ],
            [
                { type: CellType.Disk, playerId: 'foo' },
                { type: CellType.Disk, playerId: 'bar' },
                { type: CellType.Truck, goodsType: GoodsType.Cheese },
                { type: CellType.Empty }
            ],
            [
                { type: CellType.Disk, playerId: 'baz' },
                { type: CellType.Empty },
                { type: CellType.Empty },
                { type: CellType.Empty }
            ],
            [
                { type: CellType.Disk, playerId: 'qux' },
                { type: CellType.Empty },
                { type: CellType.Truck, goodsType: GoodsType.Lemonade },
                { type: CellType.Empty }
            ],
            [
                { type: CellType.Truck, goodsType: GoodsType.IceCream },
                { type: CellType.Empty },
                { type: CellType.Empty },
                { type: CellType.Empty }
            ]
        ]

        const board = new HydratedGameBoard({
            cells
        })

        state.board = board

        logBoard(board)
        const scorer = new Scorer(state)

        const scores = scorer.calculateScores()
        expect(scores.p1.score).toEqual(-21)
        expect(scores.p2.score).toEqual(-25)
    })

    it('scores correctly with adjacent truck and stall', () => {
        const state = generateTestState({ numPlayers: 3 })
        const cells: Cell[][] = [
            [
                { type: CellType.Truck, goodsType: GoodsType.Fish },
                { type: CellType.Stall, goodsType: GoodsType.Fish, playerId: 'p1' },
                { type: CellType.Market },
                { type: CellType.Empty }
            ],
            [
                { type: CellType.Disk, playerId: 'foo' },
                { type: CellType.Disk, playerId: 'bar' },
                { type: CellType.Truck, goodsType: GoodsType.Cheese },
                { type: CellType.Empty }
            ],
            [
                { type: CellType.Disk, playerId: 'baz' },
                { type: CellType.Empty },
                { type: CellType.Empty },
                { type: CellType.Empty }
            ],
            [
                { type: CellType.Disk, playerId: 'qux' },
                { type: CellType.Empty },
                { type: CellType.Truck, goodsType: GoodsType.Lemonade },
                { type: CellType.Empty }
            ],
            [
                { type: CellType.Truck, goodsType: GoodsType.IceCream },
                { type: CellType.Empty },
                { type: CellType.Empty },
                { type: CellType.Empty }
            ]
        ]

        const board = new HydratedGameBoard({
            cells
        })

        state.board = board

        logBoard(board)
        const scorer = new Scorer(state)

        const scores = scorer.calculateScores()
        expect(scores.p1.score).toEqual(-(10 + 10 + 10 + 2) + 15)
        expect(scores.p2.score).toEqual(-25)
    })
})
