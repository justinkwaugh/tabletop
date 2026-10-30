import { describe, expect, it } from 'vitest'
import { PieceKind } from '@tabletop/tzaar'
import { PIECE_MODEL } from './pieceGeometry.js'
import { isMetal, topProfile } from './pieceShape.js'

// The top as the user corrected it: a flat edge, a groove with straight walls sloping to a flat
// floor, a flat ring level with the edge, and a sunken centre rounded down to a flat floor, its
// edge at 0.38 of the radius.
const t = PIECE_MODEL.thickness
const height = (distance: number) => topProfile(distance) / t
const range = (from: number, to: number, count = 8) =>
    Array.from({ length: count + 1 }, (_, index) => from + ((to - from) * index) / count)

describe('the top of a piece', () => {
    it('is level at the edge and on the ring between the groove and the centre', () => {
        for (const distance of [...range(0.85, 0.96), ...range(0.48, 0.65)]) {
            expect(height(distance)).toBeCloseTo(1)
        }
    })

    it('has a groove with a flat floor and straight sloping walls', () => {
        const floor = height(0.75)
        expect(floor).toBeCloseTo(0.7)
        for (const distance of range(0.79, 0.71)) expect(height(distance)).toBeCloseTo(floor)
        for (const [top, bottom] of [
            [0.84, 0.79],
            [0.66, 0.71]
        ]) {
            const wall = range(top, bottom).map(height)
            const steps = wall.slice(1).map((value, index) => value - wall[index])
            for (const step of steps) expect(step).toBeCloseTo(steps[0], 6)
            expect(steps[0]).toBeLessThan(0)
        }
    })

    it('has a sunken centre rounded from its edge at 0.38 down to a flat floor', () => {
        const floor = height(0)
        expect(floor).toBeCloseTo(0.68)
        for (const distance of range(0, 0.3)) expect(height(distance)).toBeCloseTo(floor)
        expect(height(0.38)).toBeCloseTo(1)
        const edge = range(0.38, 0.3, 16).map(height)
        const steps = edge.slice(1).map((value, index) => value - edge[index])
        expect(steps.every((step) => step <= 0)).toBe(true)
        // Rounded, not cut straight: gentle at both ends, steepest in the middle.
        const steepest = Math.min(...steps)
        expect(steps[0]).toBeGreaterThan(steepest / 4)
        expect(steps.at(-1)).toBeGreaterThan(steepest / 4)
    })

    it('has its markings in metal: a Tzarra’s centre, a Tzaar’s centre and groove', () => {
        expect(isMetal(PieceKind.Tott, 0)).toBe(false)
        expect(isMetal(PieceKind.Tott, 0.75)).toBe(false)
        expect(isMetal(PieceKind.Tzarra, 0.2)).toBe(true)
        expect(isMetal(PieceKind.Tzarra, 0.75)).toBe(false)
        expect(isMetal(PieceKind.Tzaar, 0.2)).toBe(true)
        expect(isMetal(PieceKind.Tzaar, 0.75)).toBe(true)
        expect(isMetal(PieceKind.Tzaar, 0.55)).toBe(false)
        expect(isMetal(PieceKind.Tzaar, 0.9)).toBe(false)
    })
})
