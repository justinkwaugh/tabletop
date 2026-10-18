import { describe, expect, it } from 'vitest'
import { boxSamples, cornersOf } from './orientedBox.js'

const DIAGONAL = { x: Math.SQRT1_2, y: Math.SQRT1_2 }
const BOX = { centre: { x: 100, y: 50 }, along: DIAGONAL, halfLength: 10, halfWidth: 5 }

describe('an oriented box', () => {
    it('has its corners at its ends, either side of its middle line', () => {
        const [first] = cornersOf(BOX)
        expect(first.x).toBeCloseTo(100 - (10 - 5) * Math.SQRT1_2)
        expect(first.y).toBeCloseTo(50 - (10 + 5) * Math.SQRT1_2)
    })

    it('is covered by samples that reach its corners, a few steps apart', () => {
        const samples = boxSamples(BOX)
        for (const corner of cornersOf(BOX)) {
            expect(
                samples.some((point) => Math.hypot(point.x - corner.x, point.y - corner.y) < 1e-9)
            ).toBe(true)
        }
        expect(samples).toHaveLength(4 * 3)
    })
})
