import { describe, expect, it } from 'vitest'
import {
    landingPoint,
    readableBoost,
    toBoard,
    toScreen,
    type BoardFrame,
    type ScreenBox
} from './flightPlaces.js'

const PHONE: ScreenBox = { left: 0, top: 0, width: 375, height: 812 }

describe('where a phone flight lands', () => {
    it('lands on the centre of the place most in view', () => {
        // A seat's money on its card, mostly beyond the left edge, and in the waiting view.
        const card: ScreenBox = { left: -200, top: 300, width: 220, height: 40 }
        const chip: ScreenBox = { left: 40, top: 640, width: 80, height: 24 }
        expect(landingPoint([card, chip], PHONE)).toEqual({ x: 80, y: 652 })
    })

    it('lands on what the view shows of a place partly beyond the edge', () => {
        const card: ScreenBox = { left: -200, top: 300, width: 236, height: 40 }
        expect(landingPoint([card], PHONE)).toEqual({ x: 18, y: 320 })
    })

    it('lands just inside the edge nearest a place beyond the view', () => {
        const card: ScreenBox = { left: -300, top: 900, width: 220, height: 40 }
        expect(landingPoint([card], PHONE)).toEqual({ x: 12, y: 800 })
    })

    it('has nowhere to land without a place', () => {
        expect(landingPoint([], PHONE)).toBeUndefined()
    })

    it('enlarges coins on a small board and leaves them as they are on a large one', () => {
        expect(readableBoost({ left: 0, top: 0, scaleX: 0.2, scaleY: 0.2 })).toBeCloseTo(4)
        expect(readableBoost({ left: 0, top: 0, scaleX: 1.5, scaleY: 1.5 })).toBe(1)
    })

    it('turns screen points into board units and back', () => {
        const frame: BoardFrame = { left: -120, top: 90, scaleX: 0.5, scaleY: 0.5 }
        const board = toBoard(frame, { x: 30, y: 140 })
        expect(board).toEqual({ x: 300, y: 100 })
        expect(toScreen(frame, board)).toEqual({ x: 30, y: 140 })
    })
})
