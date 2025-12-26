import { describe, expect, it } from 'vitest'
import { generateBoard } from './boardGenerator.js'
import { Prng } from '@tabletop/common'

describe('Fresh Fish Board Generator Tests', () => {
    it('Builds a board correctly', () => {
        const seed = 1325337393
        const prng = new Prng({ seed: seed, invocations: 0 })
        const { board, numMarketTiles } = generateBoard(4, prng.random)

        const correctCells = [
            [
                { type: 'off' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'off' }
            ],
            [
                { type: 'off' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'off' }
            ],
            [
                { type: 'off' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'off' }
            ],
            [
                { type: 'off' },
                { type: 'empty' },
                { type: 'truck', goodsType: 'cheese' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'truck', goodsType: 'icecream' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'off' }
            ],
            [
                { type: 'off' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' }
            ],
            [
                { type: 'off' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' }
            ],
            [
                { type: 'off' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' }
            ],
            [
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' }
            ],
            [
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'road' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' }
            ],
            [
                { type: 'truck', goodsType: 'fish' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'empty' },
                { type: 'truck', goodsType: 'lemonade' },
                { type: 'empty' },
                { type: 'off' },
                { type: 'off' },
                { type: 'off' }
            ]
        ]
        expect(board.cells).toEqual(correctCells)
    })
})
