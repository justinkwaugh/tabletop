import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { detectNewRegions } from './regionDetection.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, LowenherzBoard, SquareType, WallEdge } from '../model/board.js'
import { Region } from '../model/region.js'

function blankBoard(): LowenherzBoard {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }) as BoardSquare)
        ),
        walls: []
    }
}

function withCastle(board: LowenherzBoard, col: number, row: number, color: Color): LowenherzBoard {
    board.squares[row][col] = { ...board.squares[row][col], castleColor: color }
    return board
}

describe('detectNewRegions', () => {
    it('detects a single newly-sealed region containing one castle', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, Color.Pink)
        // Elsewhere on the board, 2 other castles keep the huge open remainder from
        // also qualifying as a (single-castle) region.
        withCastle(board, 10, 5, Color.Yellow)
        withCastle(board, 12, 5, Color.Purple)

        // Enclose a 2x2 pocket around Pink's castle at the top-left corner (board
        // edges provide the north/west walls for free).
        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West }, // east side of the pocket, row 0
            { col: 2, row: 1, edge: WallEdge.West }, // east side of the pocket, row 1
            { col: 0, row: 2, edge: WallEdge.North }, // south side of the pocket, col 0
            { col: 1, row: 2, edge: WallEdge.North } // south side of the pocket, col 1
        ]

        const newRegions = detectNewRegions(board, [])
        const pinkRegion = newRegions.find((r) => r.ownerColor === Color.Pink)

        expect(pinkRegion).toBeDefined()
        expect(new Set(pinkRegion!.squareKeys)).toEqual(new Set(['0,0', '1,0', '0,1', '1,1']))
        expect(pinkRegion!.castleSquareKey).toBe('0,0')
    })

    it('one wall can seal two regions at once, matching the rulebook example', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, Color.Pink)
        withCastle(board, 1, 0, Color.Yellow)

        // Everything is walled off except the shared edge between the two castles.
        board.walls = [
            { col: 0, row: 1, edge: WallEdge.North }, // south of (0,0)
            { col: 1, row: 1, edge: WallEdge.North }, // south of (1,0)
            { col: 2, row: 0, edge: WallEdge.West } // east of (1,0)
        ]

        // Placing the last wall between the two castles seals both at once.
        board.walls.push({ col: 1, row: 0, edge: WallEdge.West })

        const newRegions = detectNewRegions(board, [])
        const pinkRegion = newRegions.find((r) => r.ownerColor === Color.Pink)
        const yellowRegion = newRegions.find((r) => r.ownerColor === Color.Yellow)

        expect(pinkRegion?.squareKeys).toEqual(['0,0'])
        expect(yellowRegion?.squareKeys).toEqual(['1,0'])
    })

    it('creates an owner-less neutral zone when a sealed pocket has no castle', () => {
        const board = blankBoard()
        withCastle(board, 10, 5, Color.Yellow)
        withCastle(board, 12, 5, Color.Purple)

        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West },
            { col: 2, row: 1, edge: WallEdge.West },
            { col: 0, row: 2, edge: WallEdge.North },
            { col: 1, row: 2, edge: WallEdge.North }
        ]

        const newRegions = detectNewRegions(board, [])
        const neutralZone = newRegions.find(
            (r) => new Set(r.squareKeys).size === 4 && [...r.squareKeys].every((k) => ['0,0', '1,0', '0,1', '1,1'].includes(k))
        )

        expect(neutralZone).toBeDefined()
        expect(neutralZone!.ownerColor).toBeUndefined()
        expect(neutralZone!.castleSquareKey).toBeUndefined()
    })

    it('does not create a region for a pocket enclosing 2+ different castles', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, Color.Pink)
        withCastle(board, 1, 0, Color.Yellow)

        // Same pocket as the "single region" test, but no wall between the two
        // castles - they're both stuck in one shared, contested pocket.
        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West },
            { col: 2, row: 1, edge: WallEdge.West },
            { col: 0, row: 2, edge: WallEdge.North },
            { col: 1, row: 2, edge: WallEdge.North }
        ]

        const newRegions = detectNewRegions(board, [])
        const contestedPocket = newRegions.find((r) => r.squareKeys.includes('0,0') && r.squareKeys.includes('1,0'))

        expect(contestedPocket).toBeUndefined()
    })

    it('does not re-report a region that is already tracked', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, Color.Pink)
        withCastle(board, 10, 5, Color.Yellow)
        withCastle(board, 12, 5, Color.Purple)

        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West },
            { col: 2, row: 1, edge: WallEdge.West },
            { col: 0, row: 2, edge: WallEdge.North },
            { col: 1, row: 2, edge: WallEdge.North }
        ]

        const firstPass = detectNewRegions(board, [])
        const pinkRegion = firstPass.find((r) => r.ownerColor === Color.Pink)!

        const existingRegions: Region[] = [pinkRegion]
        const secondPass = detectNewRegions(board, existingRegions)

        expect(secondPass.some((r) => r.ownerColor === Color.Pink)).toBe(false)
    })
})
