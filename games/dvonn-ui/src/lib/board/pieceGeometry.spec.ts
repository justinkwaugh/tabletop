import { describe, expect, it } from 'vitest'
import {
    PIECE_MODEL,
    PIECE_RADIUS,
    PROMINENT_SIDE,
    RISE,
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

    it('stands each piece a gap above the one below, and the bottom one up on its bulge', () => {
        const discs = stackDiscs(3, PIECE_RADIUS)
        const gap = PIECE_MODEL.gap * PIECE_RADIUS * RISE
        expect(discs[0].base).toBeCloseTo(-PIECE_MODEL.rise * PIECE_RADIUS * RISE)
        expect(discs[0].base - discs[1].base).toBeCloseTo(discs[0].side + gap)
    })

    it('stops a stack rising past its full height', () => {
        const full = stackBounds(PIECE_MODEL.cap, PIECE_RADIUS).top
        expect(stackBounds(PIECE_MODEL.cap + 1, PIECE_RADIUS).top).toBeCloseTo(full)
        expect(stackBounds(30, PIECE_RADIUS).top).toBeCloseTo(full)
        expect(stackBounds(2, PIECE_RADIUS).top).toBeGreaterThan(full)
    })
})

describe('DVONN pieces in a tall stack', () => {
    it('stay thicker than the pieces thinned around them', () => {
        const prominent = Array.from({ length: 40 }, (_, index) => index === 6)
        const discs = stackDiscs(40, PIECE_RADIUS, prominent)
        const pitch = (PIECE_MODEL.thickness + PIECE_MODEL.gap) * PIECE_RADIUS * RISE
        expect(discs[6].side).toBeCloseTo(pitch * PROMINENT_SIDE)
        expect(discs[6].side).toBeGreaterThan(discs[5].side * 1.5)
        expect(discs.at(-1)?.base).toBeCloseTo(stackDiscs(40, PIECE_RADIUS).at(-1)?.base ?? 0)
    })
})
