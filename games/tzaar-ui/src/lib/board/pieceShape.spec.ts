import { describe, expect, it } from 'vitest'
import { PieceKind } from '@tabletop/tzaar'
import { PIECE_MODEL } from './pieceGeometry.js'
import { isMetal, topProfile, topSpeck } from './pieceShape.js'

// The top: MATRX GIPF's disc, a flat edge and a groove whose lips round down into a level floor,
// with TZAAR's flat ring level with the edge inside the groove, and inside that a sunken centre
// rounded down to a flat floor, its edge at 0.38 of the radius.
const t = PIECE_MODEL.thickness
const height = (distance: number) => topProfile(distance) / t
const range = (from: number, to: number, count = 8) =>
    Array.from({ length: count + 1 }, (_, index) => from + ((to - from) * index) / count)

// Each step down a slope, from one end to the other: all down, gentle at both ends and steepest
// in the middle, as a rounded lip is.
function expectRounded(from: number, to: number) {
    const slope = range(from, to, 16).map(height)
    const steps = slope.slice(1).map((value, index) => value - slope[index])
    expect(steps.every((step) => step <= 0)).toBe(true)
    const steepest = Math.min(...steps)
    expect(steepest).toBeLessThan(0)
    expect(steps[0]).toBeGreaterThan(steepest / 4)
    expect(steps.at(-1)).toBeGreaterThan(steepest / 4)
}

describe('the top of a piece', () => {
    it('is level at the edge and on the ring between the groove and the centre', () => {
        for (const distance of [...range(0.85, 0.96), ...range(0.39, 0.61)]) {
            expect(height(distance)).toBeCloseTo(1)
        }
    })

    it('has a groove whose lips round down into a level floor', () => {
        const floor = height(0.73)
        expect(floor).toBeCloseTo(0.6)
        for (const distance of range(0.745, 0.715)) expect(height(distance)).toBeCloseTo(floor)
        expectRounded(0.84, 0.7476)
        expectRounded(0.62, 0.7124)
    })

    it('has a sunken centre rounded from its edge at 0.38 down to a flat floor', () => {
        const floor = height(0)
        expect(floor).toBeCloseTo(0.68)
        for (const distance of range(0, 0.3)) expect(height(distance)).toBeCloseTo(floor)
        expect(height(0.38)).toBeCloseTo(1)
        expectRounded(0.38, 0.3)
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

describe('a speck on the top', () => {
    const speck = (x: number, y: number, extent = 0.04) =>
        topSpeck(28, { tone: 'white', kind: PieceKind.Tzaar }, { x, y, extent, fill: '#1b1b1d' })

    it('is left off the metal', () => {
        expect(speck(0.1, 0)).toBeUndefined()
        expect(speck(0.73, 0)).toBeUndefined()
        expect(speck(0.5, 0)).toBeDefined()
    })

    it('shrinks to keep off a lip, and is left out if it would shrink too far', () => {
        expect(speck(0.5, 0)?.scale).toBe(1)
        expect(speck(0.6, 0)?.scale).toBeCloseTo(0.5)
        expect(speck(0.615, 0)).toBeUndefined()
        expect(speck(0.97, 0)?.scale).toBeCloseTo(0.75)
        expect(speck(0.99, 0)).toBeUndefined()
    })
})
