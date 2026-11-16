import { describe, expect, it } from 'vitest'
import { MARKER_RADIUS, RING_INNER, RING_OUTER, SPACING_UNIT } from './pieceGeometry.js'
import { SPACING } from './geometry.js'

describe('piece sizes', () => {
    it('match the board spacing', () => {
        expect(SPACING_UNIT).toBe(SPACING)
    })

    it('leave a small gap between rings on neighbouring points', () => {
        const gap = SPACING - 2 * RING_OUTER
        expect(gap).toBeGreaterThan(0)
        expect(gap).toBeLessThan(SPACING * 0.12)
    })

    it('fit a marker inside a ring', () => {
        expect(MARKER_RADIUS).toBeLessThan(RING_INNER)
        expect(RING_INNER - MARKER_RADIUS).toBeLessThan(4)
    })
})
