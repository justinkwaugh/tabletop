import { describe, expect, it } from 'vitest'
import { pieceDiscs, pieceExtent } from './pieceGeometry.js'

const RADIUS = 20

function bounds(gipf: boolean) {
    const discs = pieceDiscs(gipf, RADIUS)
    return {
        top: Math.min(...discs.map((disc) => disc.faceY)) - RADIUS,
        bottom: Math.max(...discs.map((disc) => disc.sideY)) + RADIUS
    }
}

describe('piece geometry', () => {
    it.each([false, true])('centres the visible piece on its point (gipf: %s)', (gipf) => {
        const { top, bottom } = bounds(gipf)
        expect(top + bottom).toBeCloseTo(0)
        expect(pieceExtent(gipf, RADIUS)).toBeCloseTo((bottom - top) / 2)
    })

    it('raises the top disc of a GIPF-piece clear of the lower disc’s side', () => {
        const [lower, upper] = pieceDiscs(true, RADIUS)
        expect(lower.covered).toBe(true)
        expect(upper.covered).toBe(false)
        expect(upper.sideY).toBeLessThan(lower.faceY)
    })
})
