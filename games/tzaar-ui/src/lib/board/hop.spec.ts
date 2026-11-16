import { describe, expect, it } from 'vitest'
import { HOP, hopPlan } from './hop.js'
import { PIECE_RADIUS, restingLift } from './pieceGeometry.js'

const lift = (height: number) => restingLift(height, PIECE_RADIUS)

describe('a hop', () => {
    it('starts and ends where the stack rests', () => {
        const plan = hopPlan({ spaces: 2, startLift: 0, endLift: lift(3) })
        expect(plan.startLift).toBe(0)
        expect(plan.endLift).toBe(lift(3))
    })

    it('rises above the taller end, higher the farther it goes', () => {
        const near = hopPlan({ spaces: 1, startLift: 0, endLift: lift(6) })
        const far = hopPlan({ spaces: 5, startLift: 0, endLift: lift(6) })
        expect(near.peak).toBeLessThan(lift(6) - HOP.arc + 1e-9)
        expect(far.peak).toBeLessThan(near.peak)
    })

    it('takes longer the farther it goes, up to the longest', () => {
        expect(hopPlan({ spaces: 1, startLift: 0, endLift: 0 }).duration).toBe(HOP.single)
        expect(hopPlan({ spaces: 3, startLift: 0, endLift: 0 }).duration).toBeCloseTo(
            HOP.single + 2 * HOP.perSpace
        )
        expect(hopPlan({ spaces: 9, startLift: 0, endLift: 0 }).duration).toBe(HOP.longest)
    })

    it('takes the quick length it is given, however far it goes', () => {
        expect(hopPlan({ spaces: 7, startLift: 0, endLift: 0, quick: 0.18 }).duration).toBe(0.18)
    })
})
