import { describe, expect, it } from 'vitest'
import {
    FULL_HEIGHT_PIECES,
    PIECE_RADIUS,
    PROMINENT_SIDE,
    SIDE,
    SPACING_UNIT,
    stackBounds,
    stackDiscs
} from './pieceGeometry.js'

describe('piece geometry', () => {
    it('leaves a small gap between neighbours in a row', () => {
        const gap = SPACING_UNIT - 2 * PIECE_RADIUS
        expect(gap).toBeGreaterThan(0)
        expect(gap).toBeLessThan(SPACING_UNIT * 0.1)
    })

    it('stops a stack rising past its full height', () => {
        const full = stackBounds(FULL_HEIGHT_PIECES, PIECE_RADIUS).top
        expect(stackBounds(FULL_HEIGHT_PIECES + 1, PIECE_RADIUS).top).toBeCloseTo(full)
        expect(stackBounds(30, PIECE_RADIUS).top).toBeCloseTo(full)
        expect(stackBounds(2, PIECE_RADIUS).top).toBeGreaterThan(full)
    })
})

describe('DVONN pieces in a tall stack', () => {
    it('stay thicker than the pieces thinned around them', () => {
        const prominent = Array.from({ length: 20 }, (_, index) => index === 6)
        const discs = stackDiscs(20, PIECE_RADIUS, prominent)
        expect(discs[6].side).toBeCloseTo(PIECE_RADIUS * SIDE * PROMINENT_SIDE)
        expect(discs[6].side).toBeGreaterThan(discs[5].side * 1.5)
        expect(discs.at(-1)?.faceY).toBeCloseTo(stackDiscs(20, PIECE_RADIUS).at(-1)?.faceY ?? 0)
    })
})
