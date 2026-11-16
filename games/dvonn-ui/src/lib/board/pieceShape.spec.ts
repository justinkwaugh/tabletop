import { describe, expect, it } from 'vitest'
import { PIECE_MODEL } from './pieceGeometry.js'
import { DISH_DEPTH, dish, topProfile, topSpeck } from './pieceShape.js'

// The top as the user chose it: the outer rim and the hole's edge at the same height, and from
// each the top curving down to a flat floor in the middle.
const t = PIECE_MODEL.thickness
const height = (distance: number) => topProfile(distance) / t

describe('the top of a piece', () => {
    it('stands as high at the rim as at the hole’s edge', () => {
        expect(height(1 - 0.22 * t)).toBeCloseTo(1)
        expect(height(PIECE_MODEL.hole + 0.15 * t)).toBeCloseTo(1)
    })

    it('curves down from either edge to a flat floor in the middle', () => {
        const middle = (PIECE_MODEL.hole + 1) / 2
        expect(height(middle)).toBeCloseTo(1 - DISH_DEPTH)
        for (const offset of [-0.05, 0, 0.05]) expect(dish(middle + offset)).toBeCloseTo(1)
        const outer = [0.95, 0.9, 0.85, 0.8].map(height)
        const steps = outer.slice(1).map((value, index) => value - outer[index])
        expect(steps.every((step) => step < 0)).toBe(true)
        // Steepest at the edge, levelling out onto the floor.
        expect(steps[0]).toBeLessThan(steps.at(-1) ?? 0)
    })
})

describe('a speck on the top', () => {
    const speck = (x: number, y: number, extent = 0.04) =>
        topSpeck(28, 'white', { x, y, extent, fill: '#1b1b1d' })

    it('shrinks to keep inside the edge and out of the hole, or is left out', () => {
        expect(speck(0.6, 0)?.scale).toBe(1)
        expect(speck(0.97, 0)?.scale).toBeCloseTo(0.75)
        expect(speck(0.99, 0)).toBeUndefined()
        expect(speck(PIECE_MODEL.hole + 0.02, 0)?.scale).toBeCloseTo(0.5)
        expect(speck(PIECE_MODEL.hole + 0.01, 0)).toBeUndefined()
    })

    it('is squeezed where the dish faces away and stretched where it faces you', () => {
        const nearRim = 0.92
        expect(speck(0, -nearRim)?.squeeze).toBeGreaterThan(1)
        expect(speck(0, nearRim)?.squeeze).toBeLessThan(1)
    })
})
