import { describe, expect, it } from 'vitest'
import { CoralColors } from './colors.js'
import { isRock, ReefBoardIds, ReefBoards, sameSquare } from './reefBoards.js'

describe('reef boards', () => {
    it.each(ReefBoardIds)('board %i has 33 rock squares', (boardId) => {
        expect(ReefBoards[boardId].rock).toHaveLength(33)
    })

    it.each(ReefBoardIds)('board %i starts one polyp of each colour, all on rock', (boardId) => {
        const { startingPolyps } = ReefBoards[boardId]
        expect(startingPolyps.map((polyp) => polyp.color).sort()).toEqual([...CoralColors].sort())
        for (const polyp of startingPolyps) {
            expect(isRock(boardId, polyp.coords)).toBe(true)
        }
    })

    it.each(ReefBoardIds)('board %i has its extra-growth square on empty rock', (boardId) => {
        const { extraGrowth, startingPolyps } = ReefBoards[boardId]
        expect(isRock(boardId, extraGrowth)).toBe(true)
        expect(startingPolyps.some((polyp) => sameSquare(polyp.coords, extraGrowth))).toBe(false)
    })

    it('matches the checked board map', () => {
        expect(ReefBoards[4].startingPolyps).toContainEqual({
            coords: { row: 4, col: 2 },
            color: 'orange'
        })
        expect(ReefBoards[4].extraGrowth).toEqual({ row: 3, col: 3 })
        expect(isRock(1, { row: 2, col: 1 })).toBe(false)
        expect(isRock(2, { row: 3, col: 3 })).toBe(true)
        expect(isRock(4, { row: 4, col: 0 })).toBe(true)
        expect(isRock(1, { row: 0, col: 2 })).toBe(false)
    })
})
