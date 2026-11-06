import { MARBLE_RADIUS, RING_INNER_RADIUS, RING_OUTER_RADIUS } from './geometry.js'

// Shadows are soft-edged gradient fills rather than shapes under a blur filter, which phones are
// slow to paint. Each gradient follows the edge a Gaussian blur of SOFTNESS gives a hard shape.
const SOFTNESS = 2.5
// The blur's reach: past three deviations nothing shows.
const REACH = SOFTNESS * 3
const STEP = 0.5

export type ShadowStop = { offset: number; opacity: number }

// A marble's shadow, a disc, out to its blurred edge.
export const MARBLE_SHADOW_RADIUS = MARBLE_RADIUS + REACH
// A ring's shadow, a band between its inner and outer edges, out to its blurred outer edge.
export const RING_SHADOW_RADIUS = RING_OUTER_RADIUS + REACH

export const MARBLE_SHADOW_STOPS = blurredStops(-Infinity, MARBLE_RADIUS, MARBLE_SHADOW_RADIUS)
export const RING_SHADOW_STOPS = blurredStops(
    RING_INNER_RADIUS,
    RING_OUTER_RADIUS,
    RING_SHADOW_RADIUS
)

// The stops of a band from `inner` to `outer` blurred (a disc's `inner` is -Infinity), out to `radius`: the share of full shadow
// at each distance from the centre. Flat runs keep only their ends.
export function blurredStops(inner: number, outer: number, radius: number): ShadowStop[] {
    const stops: ShadowStop[] = []
    for (let distance = 0; distance <= radius + STEP / 2; distance += STEP) {
        const reached = Math.min(distance, radius)
        // The last stop is clear, so the fill's own edge never shows.
        const opacity =
            reached === radius ? 0 : round(covered(reached - outer) - covered(reached - inner))
        const last = stops.at(-1)
        const beforeLast = stops.at(-2)
        if (last?.opacity === opacity && beforeLast?.opacity === opacity) stops.pop()
        stops.push({ offset: round(reached / radius), opacity })
    }
    return stops
}

// How much of a blurred edge `past` units beyond it is still covered (from 1 well inside to 0
// well outside).
function covered(past: number): number {
    return 0.5 * (1 - erf(past / (SOFTNESS * Math.SQRT2)))
}

// Abramowitz and Stegun 7.1.26, good to 1.5e-7.
function erf(x: number): number {
    const sign = Math.sign(x)
    const t = 1 / (1 + 0.3275911 * Math.abs(x))
    const poly =
        t *
        (0.254829592 +
            t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    return sign * (1 - poly * Math.exp(-x * x))
}

function round(value: number): number {
    return Math.round(value * 1000) / 1000
}
