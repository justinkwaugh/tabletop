import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { assembleBoard } from './boardAssembly.js'
import { BOARD_COLS, BOARD_ROWS, SquareType } from '../model/board.js'
import { BoardTiles } from '../definition/boardTiles.js'

const TILE_SIZE = 5

// Rotates a plain terrain grid 90 degrees clockwise - a standalone reimplementation
// (not importing boardAssembly's private rotate90) so the test independently verifies
// the tileLayout rotation actually matches the assembled squares.
function rotate90(grid: SquareType[][]): SquareType[][] {
    const n = grid.length
    const result: SquareType[][] = Array.from({ length: n }, () => new Array(n))
    for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
            result[col][n - 1 - row] = grid[row][col]
        }
    }
    return result
}

function rotateGrid(grid: SquareType[][], degrees: 0 | 90 | 180 | 270): SquareType[][] {
    let result = grid
    for (let i = 0; i < degrees / 90; i++) {
        result = rotate90(result)
    }
    return result
}

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

    it('records exactly one tileLayout entry per slot, covering every tile id and every position once', () => {
        const board = assembleBoard(new Prng({ seed: 3, invocations: 0 }))

        expect(board.tileLayout).toHaveLength(6)
        expect(board.tileLayout!.map((t) => t.tileId).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])

        const positions = board.tileLayout!.map((t) => `${t.tileCol},${t.tileRow}`).sort()
        expect(positions).toEqual(['0,0', '0,1', '1,0', '1,1', '2,0', '2,1'])

        for (const entry of board.tileLayout!) {
            expect([0, 90, 180, 270]).toContain(entry.rotation)
        }
    })

    it('tileLayout accurately describes the terrain actually placed in each slot', () => {
        const board = assembleBoard(new Prng({ seed: 11, invocations: 0 }))

        for (const { tileId, tileCol, tileRow, rotation } of board.tileLayout!) {
            const tile = BoardTiles.find((t) => t.id === tileId)!
            const expectedSquares = rotateGrid(tile.squares, rotation)

            for (let r = 0; r < TILE_SIZE; r++) {
                for (let c = 0; c < TILE_SIZE; c++) {
                    const globalRow = tileRow * TILE_SIZE + r
                    const globalCol = tileCol * TILE_SIZE + c
                    expect(board.squares[globalRow][globalCol].type).toBe(expectedSquares[r][c])
                }
            }
        }
    })
})
