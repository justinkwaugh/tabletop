import { describe, expect, it } from 'vitest'
import {
    countKnights,
    findConnectedComponents,
    regionsAreNeighboring,
    removeInteriorWalls,
    scoreRegion,
    scoreSpacesAndTowns
} from './regionScoring.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, LowenherzBoard, SquareType, WallEdge } from '../model/board.js'
import { Region } from '../model/region.js'
import { Color } from '@tabletop/common'

function blankBoard(): LowenherzBoard {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }) as BoardSquare)
        ),
        walls: []
    }
}

function region(squareKeys: string[], id = 'r1', ownerColor = Color.Pink): Region {
    return { id, ownerColor, squareKeys, castleSquareKey: squareKeys[0] }
}

describe('scoreRegion', () => {
    it('looks up power points by the region-creation table', () => {
        const board = blankBoard()

        expect(scoreRegion(region(['0,0', '1,0', '0,1', '1,1']), board)).toBe(3) // 4 spaces
        expect(scoreRegion(region(Array.from({ length: 5 }, (_, i) => `${i},0`)), board)).toBe(5)
        expect(scoreRegion(region(Array.from({ length: 10 }, (_, i) => `${i},0`)), board)).toBe(5)
        expect(scoreRegion(region(Array.from({ length: 11 }, (_, i) => `${i},0`)), board)).toBe(7)
        expect(scoreRegion(region(Array.from({ length: 20 }, (_, i) => `${i},0`)), board)).toBe(7)
        expect(scoreRegion(region(Array.from({ length: 21 }, (_, i) => `${i},0`)), board)).toBe(9)
        expect(scoreRegion(region(Array.from({ length: 30 }, (_, i) => `${i},0`)), board)).toBe(9)
        expect(scoreRegion(region(Array.from({ length: 31 }, (_, i) => `${i},0`)), board)).toBe(12)
    })

    it('scores the smallest possible region', () => {
        // A single-square region is still in the 1-4 band. Worth pinning explicitly: the
        // band edges above start at 4, so nothing else covers the bottom of the table.
        expect(scoreRegion(region(['0,0']), blankBoard())).toBe(3)
    })

    it('adds 5 power points per town in the region', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Village }
        board.squares[0][1] = { type: SquareType.Village }

        // 4 spaces (base 3) with 2 towns = 3 + 10 = 13
        expect(scoreRegion(region(['0,0', '1,0', '0,1', '1,1']), board)).toBe(13)
    })
})

describe('scoreSpacesAndTowns', () => {
    it('applies the same table as scoreRegion, to plain counts', () => {
        expect(scoreSpacesAndTowns(1, 0)).toBe(3)
        expect(scoreSpacesAndTowns(4, 0)).toBe(3)
        expect(scoreSpacesAndTowns(5, 0)).toBe(5)
        expect(scoreSpacesAndTowns(10, 0)).toBe(5)
        expect(scoreSpacesAndTowns(11, 0)).toBe(7)
        expect(scoreSpacesAndTowns(20, 0)).toBe(7)
        expect(scoreSpacesAndTowns(21, 0)).toBe(9)
        expect(scoreSpacesAndTowns(30, 0)).toBe(9)
        expect(scoreSpacesAndTowns(31, 0)).toBe(12)
    })

    it('adds 5 per town, matching scoreRegion', () => {
        expect(scoreSpacesAndTowns(4, 2)).toBe(13)
        expect(scoreSpacesAndTowns(11, 1)).toBe(12)
    })

    it('scores nothing for nothing', () => {
        // The zero case is what makes the combined-stranding arithmetic work: the first
        // stranding of an expansion has no prior total to subtract (see ExpandRegion.apply),
        // so an empty tally has to be worth 0 rather than the 1-4 band's 3.
        expect(scoreSpacesAndTowns(0, 0)).toBe(0)
        expect(scoreSpacesAndTowns(0, 3)).toBe(0)
    })
})

describe('removeInteriorWalls', () => {
    it('removes a wall entirely inside the region but keeps the outer boundary wall', () => {
        const board = blankBoard()
        const interiorWall = { col: 1, row: 0, edge: WallEdge.West } // between (0,0) and (1,0)
        const boundaryWall = { col: 2, row: 0, edge: WallEdge.West } // between (1,0) and (2,0) - (2,0) is outside
        board.walls = [interiorWall, boundaryWall]

        removeInteriorWalls(board, region(['0,0', '1,0']))

        expect(board.walls).toEqual([boundaryWall])
    })
})

describe('countKnights', () => {
    it('counts only squares with a knight belonging to the region\'s own color', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Yellow } // wrong color, not counted
        board.squares[1][0] = { type: SquareType.Blank, castleColor: Color.Pink } // castle, not a knight

        expect(countKnights(region(['0,0', '1,0', '0,1']), board)).toBe(1)
    })
})

describe('regionsAreNeighboring', () => {
    it('is true when a square in one region is orthogonally adjacent to a square in the other', () => {
        const a = region(['0,0', '1,0'], 'a', Color.Pink)
        const b = region(['2,0', '2,1'], 'b', Color.Yellow) // (2,0) is adjacent to (1,0)

        expect(regionsAreNeighboring(a, b)).toBe(true)
        expect(regionsAreNeighboring(b, a)).toBe(true)
    })

    it('is false when no squares are orthogonally adjacent, even diagonally close ones', () => {
        const a = region(['0,0'], 'a', Color.Pink)
        const b = region(['1,1'], 'b', Color.Yellow) // only a diagonal neighbor, not orthogonal

        expect(regionsAreNeighboring(a, b)).toBe(false)
    })

    it('ignores walls between the regions - adjacency alone is enough', () => {
        const a = region(['0,0'], 'a', Color.Pink)
        const b = region(['1,0'], 'b', Color.Yellow)

        expect(regionsAreNeighboring(a, b)).toBe(true)
    })

    it('is false for regions that are far apart', () => {
        const a = region(['0,0'], 'a', Color.Pink)
        const b = region(['9,9'], 'b', Color.Yellow)

        expect(regionsAreNeighboring(a, b)).toBe(false)
    })
})

describe('findConnectedComponents', () => {
    it('returns a single component when every square is orthogonally reachable', () => {
        const components = findConnectedComponents(['0,0', '1,0', '1,1'])
        expect(components).toHaveLength(1)
        expect(components[0].sort()).toEqual(['0,0', '1,0', '1,1'])
    })

    it('splits into separate components when squares are not connected', () => {
        const components = findConnectedComponents(['0,0', '1,0', '5,5'])
        expect(components).toHaveLength(2)
        const sizes = components.map((c) => c.length).sort()
        expect(sizes).toEqual([1, 2])
    })
})
