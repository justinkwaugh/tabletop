import { describe, expect, it } from 'vitest'
import { hopAt, hopPlan, type HopSpec } from './hop.js'
import { PIECE_RADIUS, restingLift, SPACING_UNIT } from './pieceGeometry.js'

// Samples the hop and returns the lowest the flier is (largest lift) while its footprint overlaps
// each stack it passes over, less that stack's resting lift: positive means it went through.
function worstClearance(spec: HopSpec): number {
    const plan = hopPlan(spec)
    let worst = -Infinity
    for (let step = 0; step <= 400; step++) {
        const { along, lift } = hopAt(plan, (plan.duration * step) / 400)
        const position = along * spec.spaces * SPACING_UNIT
        spec.over.forEach((rest, index) => {
            const at = (index + 1) * SPACING_UNIT
            if (rest < 0 && Math.abs(position - at) < 2 * PIECE_RADIUS)
                worst = Math.max(worst, lift - rest)
        })
    }
    return worst
}

const lift = (height: number) => restingLift(height, PIECE_RADIUS)

describe('a hop', () => {
    it('starts and ends where the stack rests', () => {
        const spec = { spaces: 2, startLift: 0, endLift: lift(3), over: [lift(1)], quick: false }
        const plan = hopPlan(spec)
        expect(hopAt(plan, 0)).toEqual({ along: 0, lift: 0 })
        expect(hopAt(plan, plan.duration).along).toBeCloseTo(1)
        expect(hopAt(plan, plan.duration).lift).toBeCloseTo(lift(3))
    })

    it('rises above the taller end', () => {
        const plan = hopPlan({ spaces: 1, startLift: 0, endLift: lift(6), over: [], quick: false })
        expect(plan.peak).toBeLessThan(lift(6) - 20)
        expect(plan.groundStart).toBe(0)
        expect(plan.groundEnd).toBe(plan.duration)
    })

    it.each([
        ['a single stack', 2, [10]],
        ['a low stack, then a tall one', 3, [1, 10]],
        ['a tall stack, then a low one', 3, [10, 1]]
    ])('comes down once past %s that sets its height', (_name, spaces, over) => {
        const plan = hopPlan({
            spaces,
            startLift: 0,
            endLift: lift(1),
            over: over.map(lift),
            quick: false
        })
        const tallest = (over.indexOf(Math.max(...over)) + 1) / spaces
        let previous = -Infinity
        for (let step = 0; step <= 200; step++) {
            const { along, lift: height } = hopAt(plan, (plan.duration * step) / 200)
            if (along >= tallest) {
                expect(height).toBeGreaterThanOrEqual(previous - 1e-9)
                previous = height
            }
        }
    })

    it.each([
        ['a tall stack between low ones', 2, 0, 1, [12]],
        ['several tall stacks', 4, 0, 2, [8, 13, 3]],
        ['a tall stack just before the landing', 3, 0, 1, [1, 20]],
        ['back home from a stack, over a taller one', 2, 9, 0, [13]],
        ['a long hop', 10, 0, 1, [1, 2, 3, 13, 5, 6, 7, 8, 9]],
        ['a tall stack beyond an empty space', 3, 0, 1, [0, 12]]
    ])('clears %s', (_name, spaces, from, to, over) => {
        for (const quick of [false, true]) {
            const spec = {
                spaces,
                startLift: lift(from),
                endLift: lift(to),
                over: over.map(lift),
                quick
            }
            expect(worstClearance(spec)).toBeLessThanOrEqual(0)
        }
    })
})
