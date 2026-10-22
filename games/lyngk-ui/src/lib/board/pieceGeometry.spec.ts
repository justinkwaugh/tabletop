import { describe, expect, it } from 'vitest'
import { sideHeight, stackBounds, stackDiscs, topFaceY } from './pieceGeometry.js'
import { PIECE_RADIUS, pointCenter, SPACING } from './geometry.js'

describe('stack geometry', () => {
    it('centres a single piece on its point', () => {
        const { top, bottom } = stackBounds(1, 20)
        expect(top + bottom).toBeCloseTo(0)
    })

    it('raises each disc one side height above the one below', () => {
        const [lower, upper] = stackDiscs(2, 20)
        expect(lower.faceY - upper.faceY).toBeCloseTo(sideHeight(20))
        expect(topFaceY(2, 20)).toBeCloseTo(upper.faceY)
    })

    it('leaves a small gap between a stack of 5 and a single above it', () => {
        const gap = SPACING + stackBounds(5, PIECE_RADIUS).top - stackBounds(1, PIECE_RADIUS).bottom
        expect(gap).toBeGreaterThan(2)
        expect(gap).toBeLessThan(5)
    })

    it('leaves a small gap between pieces on neighbouring columns', () => {
        const columnGap = pointCenter({ q: 1, r: 0 }).x - pointCenter({ q: 0, r: 0 }).x
        const gap = columnGap - 2 * PIECE_RADIUS
        expect(gap).toBeGreaterThan(2)
        expect(gap).toBeLessThan(5)
    })
})
