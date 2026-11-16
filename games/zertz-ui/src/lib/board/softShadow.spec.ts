import { describe, expect, it } from 'vitest'
import { MARBLE_RADIUS, RING_INNER_RADIUS, RING_OUTER_RADIUS } from './geometry.js'
import {
    blurredStops,
    MARBLE_SHADOW_RADIUS,
    MARBLE_SHADOW_STOPS,
    RING_SHADOW_RADIUS,
    RING_SHADOW_STOPS
} from './softShadow.js'

// The gradient's opacity at `offset`, between its stops as the browser draws it.
function opacityAt(stops: { offset: number; opacity: number }[], offset: number) {
    const after = stops.findIndex((stop) => stop.offset >= offset)
    if (after <= 0) return stops[Math.max(after, 0)].opacity
    const [from, to] = [stops[after - 1], stops[after]]
    return (
        from.opacity +
        ((to.opacity - from.opacity) * (offset - from.offset)) / (to.offset - from.offset)
    )
}

describe('soft shadows', () => {
    it('darkens a marble shadow fully inside, half at its edge and not at all at its reach', () => {
        expect(MARBLE_SHADOW_STOPS[0]).toEqual({ offset: 0, opacity: 1 })
        expect(opacityAt(MARBLE_SHADOW_STOPS, MARBLE_RADIUS / MARBLE_SHADOW_RADIUS)).toBeCloseTo(
            0.5,
            1
        )
        expect(MARBLE_SHADOW_STOPS.at(-1)).toEqual({ offset: 1, opacity: 0 })
    })

    it('darkens only the band of a ring shadow, half at each of its edges', () => {
        expect(RING_SHADOW_STOPS[0]).toEqual({ offset: 0, opacity: 0 })
        expect(opacityAt(RING_SHADOW_STOPS, RING_INNER_RADIUS / RING_SHADOW_RADIUS)).toBeCloseTo(
            0.5,
            1
        )
        const middle = (RING_INNER_RADIUS + RING_OUTER_RADIUS) / 2 / RING_SHADOW_RADIUS
        expect(opacityAt(RING_SHADOW_STOPS, middle)).toBeCloseTo(1, 2)
        expect(opacityAt(RING_SHADOW_STOPS, RING_OUTER_RADIUS / RING_SHADOW_RADIUS)).toBeCloseTo(
            0.5,
            1
        )
        expect(RING_SHADOW_STOPS.at(-1)).toEqual({ offset: 1, opacity: 0 })
    })

    it('runs outwards, keeping only the ends of flat runs', () => {
        const stops = blurredStops(10, 20, 30)
        for (let index = 1; index < stops.length; index++) {
            expect(stops[index].offset).toBeGreaterThan(stops[index - 1].offset)
        }
        for (let index = 2; index < stops.length; index++) {
            const run = stops.slice(index - 2, index + 1).map((stop) => stop.opacity)
            expect(new Set(run).size).toBeGreaterThan(1)
        }
    })
})
