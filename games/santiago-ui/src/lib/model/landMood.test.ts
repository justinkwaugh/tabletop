import { describe, expect, it } from 'vitest'
import {
    CropType,
    SquareType,
    type BoardSquare,
    type HydratedSantiagoGameState
} from '@tabletop/santiago'
import { landMood } from './landMood.js'

function boardWith(living: number, dried: number): HydratedSantiagoGameState {
    const squares = Array.from({ length: 8 }, () =>
        Array.from({ length: 6 }, (): BoardSquare => ({
            type: SquareType.Empty,
            hasPalmTree: false
        }))
    )
    for (let i = 0; i < living + dried; i++) {
        squares[i % 8][Math.floor(i / 8)] = {
            type: SquareType.Field,
            crop: CropType.Chili,
            playerId: 'p1',
            farmerCapacity: 2,
            farmerCount: 1,
            dried: i >= living
        } as BoardSquare
    }
    return { board: { squares } } as unknown as HydratedSantiagoGameState
}

describe('landMood', () => {
    it('shows no drought until half the placed fields have dried', () => {
        expect(landMood(boardWith(0, 0)).drought).toBe(0)
        expect(landMood(boardWith(11, 9)).drought).toBe(0)
        expect(landMood(boardWith(10, 10)).drought).toBe(0)
    })

    it('grows the drought from half the fields dried to all of them', () => {
        expect(landMood(boardWith(5, 15)).drought).toBeCloseTo(0.5)
        expect(landMood(boardWith(0, 20)).drought).toBe(1)
    })

    it('lets the drought damp the lushness', () => {
        expect(landMood(boardWith(24, 0)).lush).toBe(1)
        expect(landMood(boardWith(9, 27)).lush).toBeCloseTo((9 / 24) * 0.5)
    })
})
