import { describe, expect, it } from 'vitest'
import { CoralColors } from './colors.js'
import { sameCoordinates } from '@tabletop/common'
import { isRock, ReefBoardIds, ReefBoards } from './reefBoards.js'

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
        expect(startingPolyps.some((polyp) => sameCoordinates(polyp.coords, extraGrowth))).toBe(
            false
        )
    })

    it('matches the official board art', () => {
        expect(ReefBoards[1].startingPolyps).toContainEqual({
            coords: { row: 1, col: 3 },
            color: 'white'
        })
        expect(ReefBoards[3].extraGrowth).toEqual({ row: 3, col: 2 })
        expect(isRock(1, { row: 2, col: 2 })).toBe(false)
        expect(isRock(4, { row: 3, col: 4 })).toBe(false)
        expect(isRock(3, { row: 6, col: 5 })).toBe(true)
        expect(isRock(2, { row: 3, col: 5 })).toBe(false)
    })
})
