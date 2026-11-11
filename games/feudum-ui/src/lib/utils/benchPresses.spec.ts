import { describe, expect, it } from 'vitest'
import { widenedSpans } from './benchPresses.js'

const lane = (index: number) => ({ x: 139 + index * 36, width: 36 })

describe('widenedSpans (S68, contract: Touch targets)', () => {
    it('a lone press grows evenly to both sides', () => {
        expect(widenedSpans([lane(2)], 500, 50)).toEqual([{ x: 139 + 72 - 7, width: 50 }])
    })

    it('a press already wide enough stays as it is', () => {
        expect(widenedSpans([{ x: 10, width: 80 }], 500, 50)).toEqual([{ x: 10, width: 80 }])
    })

    it('a press at the edge takes what it lacks from the other side', () => {
        expect(widenedSpans([{ x: 2, width: 36 }], 500, 50)).toEqual([{ x: 0, width: 50 }])
        expect(widenedSpans([{ x: 462, width: 36 }], 500, 50)).toEqual([{ x: 450, width: 50 }])
    })

    it('two abutting presses each grow away from the other', () => {
        const [first, second] = widenedSpans([lane(1), lane(2)], 500, 50)
        expect(first).toEqual({ x: 175 - 14, width: 50 })
        expect(second).toEqual({ x: 211, width: 50 })
        expect(first!.x + first!.width).toBeLessThanOrEqual(second!.x)
    })

    it('neighbours share a narrow gap by what each wants, in any order given', () => {
        const spans = widenedSpans(
            [
                { x: 60, width: 40 },
                { x: 0, width: 30 }
            ],
            500,
            50
        )
        expect(spans[1]).toEqual({ x: 0, width: 50 })
        expect(spans[0]!.x).toBeGreaterThanOrEqual(spans[1]!.x + spans[1]!.width)
        expect(spans[0]!.width).toBe(50)
    })

    it('every press keeps its own lane, inside the area, clear of its neighbours', () => {
        const lanes = [0, 1, 2, 3, 4, 5].map(lane)
        const spans = widenedSpans(lanes, 500, 67)
        spans.forEach((span, at) => {
            expect(span.x).toBeLessThanOrEqual(lanes[at]!.x)
            expect(span.x + span.width).toBeGreaterThanOrEqual(lanes[at]!.x + lanes[at]!.width)
            expect(span.x).toBeGreaterThanOrEqual(0)
            expect(span.x + span.width).toBeLessThanOrEqual(500)
            if (at > 0) {
                expect(span.x).toBeGreaterThanOrEqual(
                    spans[at - 1]!.x + spans[at - 1]!.width - 1e-9
                )
            }
        })
    })

    it('a press between two abutting presses keeps only its own lane', () => {
        const [, middle] = widenedSpans([lane(1), lane(2), lane(3)], 500, 50)
        expect(middle).toEqual(lane(2))
    })
})
