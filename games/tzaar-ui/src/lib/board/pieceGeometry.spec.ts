import { describe, expect, it } from 'vitest'
import { addAxial } from '@tabletop/common'
import { DIRECTIONS, isSpace, SPACES } from '@tabletop/tzaar'
import { flatCenter } from './geometry.js'
import {
    PIECE_MODEL,
    PIECE_RADIUS,
    RISE,
    ROTATED_PIECE_MODEL,
    SPACING_UNIT,
    restingLift,
    stackBounds,
    stackDiscs,
    topFaceY
} from './pieceGeometry.js'

describe('piece geometry', () => {
    it('leaves a small gap between every pair of neighbours', () => {
        const gaps = SPACES.flatMap((coords) =>
            DIRECTIONS.map((direction) => addAxial(coords, direction))
                .filter(isSpace)
                .map((neighbour) => {
                    const a = flatCenter(coords)
                    const b = flatCenter(neighbour)
                    return Math.hypot(a.x - b.x, a.y - b.y) - 2 * PIECE_RADIUS
                })
        )
        expect(Math.min(...gaps)).toBeGreaterThan(0)
        expect(Math.max(...gaps)).toBeLessThan(SPACING_UNIT * 0.1)
    })

    it('stands each disc a gap above the one below, and the bottom one the same gap up', () => {
        const discs = stackDiscs(3, PIECE_RADIUS)
        const gap = PIECE_MODEL.gap * PIECE_RADIUS * RISE
        expect(discs[0].base).toBeCloseTo(-gap)
        expect(discs[0].base - discs[1].base).toBeCloseTo(discs[0].side + gap)
        expect(discs[1].base - discs[2].base).toBeCloseTo(discs[0].side + gap)
    })

    it.each([
        ['the board', 5, PIECE_MODEL],
        ['the rotated board', 9, ROTATED_PIECE_MODEL]
    ] as const)('stops a stack rising past its limit on %s, %i pieces', (_name, cap, model) => {
        expect(model.cap).toBe(cap)
        const full = stackBounds(cap, PIECE_RADIUS, model).top
        expect(stackBounds(cap - 1, PIECE_RADIUS, model).top).toBeGreaterThan(full)
        expect(stackBounds(cap + 1, PIECE_RADIUS, model).top).toBeCloseTo(full)
        expect(stackBounds(30, PIECE_RADIUS, model).top).toBeCloseTo(full)
        const thinned = stackDiscs(cap + 3, PIECE_RADIUS, model)
        expect(thinned[0].full && thinned.at(-1)?.full).toBe(true)
        expect(thinned.slice(1, -1).every((disc) => !disc.full)).toBe(true)
    })

    it.each([0, 1, 2, 3])(
        'lands a moving stack where the stack it makes draws it, on a stack of %i',
        (below) => {
            const moving = stackDiscs(1, PIECE_RADIUS)[0].base + restingLift(below, PIECE_RADIUS)
            const drawn = stackDiscs(below + 1, PIECE_RADIUS)[below].base
            expect(moving).toBeCloseTo(drawn)
        }
    )

    it('rests a moving stack on the top of a thinned stack, as it is drawn', () => {
        const below = PIECE_MODEL.cap + 4
        expect(restingLift(below, PIECE_RADIUS)).toBeCloseTo(topFaceY(below, PIECE_RADIUS))
        expect(topFaceY(below, PIECE_RADIUS)).toBeCloseTo(topFaceY(PIECE_MODEL.cap, PIECE_RADIUS))
    })
})
