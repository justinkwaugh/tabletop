import { describe, expect, it } from 'vitest'
import { arrivalSchedule, PiecesTimings } from './piecesAnimator.js'

describe('arrivalSchedule', () => {
    it('turns coral tiles over only once the cylinder has landed', () => {
        for (const timing of [PiecesTimings.ACTION, PiecesTimings.OWN]) {
            for (const removed of [0, 1]) {
                const { arriveAt, flipAt } = arrivalSchedule(removed, timing, true)
                expect(flipAt).toBeGreaterThanOrEqual(arriveAt + timing.arrive)
            }
        }
    })

    it('holds arrivals back only for pieces really taken away', () => {
        const timing = PiecesTimings.ACTION
        expect(arrivalSchedule(0, timing, true).arriveAt).toBe(0)
        expect(arrivalSchedule(1, timing, true).arriveAt).toBe(timing.arriveAfterLeaving)
    })

    it('finishes every step without an action within 200ms', () => {
        const timing = PiecesTimings.FAST
        for (const removed of [0, 1]) {
            const { arriveAt, flipAt } = arrivalSchedule(removed, timing, false)
            const longest = Math.max(
                timing.leave,
                arriveAt + timing.arrive,
                timing.move,
                flipAt + 2 * timing.flipHalf,
                timing.hold
            )
            expect(longest).toBeLessThanOrEqual(0.2)
        }
    })
})
