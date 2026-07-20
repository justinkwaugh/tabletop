import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { assembleBoard } from './boardAssembly.js'
import { BOARD_COLS, BOARD_ROWS, SquareType } from '../model/board.js'
import { BoardTiles } from '../definition/boardTiles.js'

function countTypes(squares: { type: SquareType }[][]): Record<SquareType, number> {
    const counts: Record<SquareType, number> = {
        [SquareType.Blank]: 0,
        [SquareType.Forest]: 0,
        [SquareType.Hill]: 0,
        [SquareType.Village]: 0
    }
    for (const row of squares) {
        for (const square of row) {
            counts[square.type]++
        }
    }
    return counts
}

describe('assembleBoard', () => {
    it('produces a board of the right dimensions with no walls', () => {
        const board = assembleBoard(new Prng({ seed: 1, invocations: 0 }))
        expect(board.squares.length).toBe(BOARD_ROWS)
        for (const row of board.squares) {
            expect(row.length).toBe(BOARD_COLS)
        }
        expect(board.walls).toEqual([])
    })

    it('preserves the total terrain composition of all 6 tiles regardless of shuffle/rotation', () => {
        const allTileSquares = BoardTiles.flatMap((tile) => tile.squares.flat()).map((type) => ({ type }))
        const expected = countTypes([allTileSquares])

        const board = assembleBoard(new Prng({ seed: 42, invocations: 0 }))
        const actual = countTypes(board.squares)

        expect(actual).toEqual(expected)
    })

    it('is deterministic for a given seed', () => {
        const boardA = assembleBoard(new Prng({ seed: 7, invocations: 0 }))
        const boardB = assembleBoard(new Prng({ seed: 7, invocations: 0 }))
        expect(boardA).toEqual(boardB)
    })

    it('produces different layouts for different seeds', () => {
        const boardA = assembleBoard(new Prng({ seed: 1, invocations: 0 }))
        const boardB = assembleBoard(new Prng({ seed: 2, invocations: 0 }))
        expect(boardA).not.toEqual(boardB)
    })
})
