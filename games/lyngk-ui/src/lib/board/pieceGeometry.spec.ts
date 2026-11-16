import { describe, expect, it } from 'vitest'
import { sideHeight, stackBounds, stackDiscs, topFaceY } from './pieceGeometry.js'
import { BoardView, PIECE_RADIUS, VIEW } from './geometry.js'

describe('stack geometry', () => {
    it('stands a stack on its point, reaching the face ellipse below it', () => {
        expect(stackBounds(VIEW, 3, 20).bottom).toBeCloseTo(20 * VIEW.tilt)
    })

    it('raises each disc one side height above the one below', () => {
        const [lower, upper] = stackDiscs(VIEW, 2, 20)
        expect(lower.faceY - upper.faceY).toBeCloseTo(sideHeight(VIEW, 20))
        expect(topFaceY(VIEW, 2, 20)).toBeCloseTo(upper.faceY)
    })

    it('shows no side seen straight down', () => {
        expect(sideHeight(new BoardView(1), 20)).toBeCloseTo(0)
    })

    it('leaves a small gap between pieces on neighbouring columns', () => {
        const columnGap = VIEW.center({ q: 1, r: 0 }).x - VIEW.center({ q: 0, r: 0 }).x
        const gap = columnGap - 2 * PIECE_RADIUS
        expect(gap).toBeGreaterThan(2)
        expect(gap).toBeLessThan(5)
    })
})
