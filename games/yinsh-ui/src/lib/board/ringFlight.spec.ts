import { describe, expect, it } from 'vitest'
import { flightPose, progressAt } from './ringFlight.js'

describe('flightPose', () => {
    it('starts on its point and ends on the board at its place', () => {
        expect(flightPose(0, 240)).toMatchObject({ along: 0, lift: 0 })
        expect(flightPose(1, 240)).toMatchObject({ along: 240, lift: 0, scale: 1 })
        expect(flightPose(1, 240, true)).toMatchObject({ along: 240, lift: 0 })
    })

    it('touches down short of its place and slides in', () => {
        const touchdown = flightPose(0.68, 240)
        expect(touchdown.lift).toBeCloseTo(0)
        expect(touchdown.along).toBeLessThan(240)
        expect(flightPose(0.9, 240).lift).toBe(0)
    })

    it('never goes back along its path', () => {
        let previous = 0
        for (let step = 0; step <= 100; step++) {
            const { along } = flightPose(step / 100, 240)
            expect(along).toBeGreaterThanOrEqual(previous - 1e-9)
            previous = along
        }
    })

    it('finds when the ring passes a point', () => {
        const u = progressAt(120, 240)
        expect(flightPose(u, 240).along).toBeGreaterThanOrEqual(120)
        expect(flightPose(u - 0.01, 240).along).toBeLessThan(120)
    })
})
