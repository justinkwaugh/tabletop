import { PIECE_RADIUS, TILT } from './geometry.js'

// A gradient fill rather than a blur filter, which phones are slow to paint. It follows the edge a
// Gaussian blur of SOFTNESS gives the piece's footprint, an ellipse PIECE_RADIUS across.
const SOFTNESS = 2.5
// The blur's reach: past three deviations nothing shows.
const REACH = SOFTNESS * 3
const STEP = 0.5

export type ShadowStop = { offset: number; opacity: number }

export const SHADOW = {
    rx: PIECE_RADIUS + REACH,
    ry: PIECE_RADIUS * TILT + REACH,
    // Below the piece, so it shows past the front edge.
    cy: 2,
    opacity: 0.3
}

export const SHADOW_STOPS = blurredStops(PIECE_RADIUS, SHADOW.rx)

function blurredStops(outer: number, radius: number): ShadowStop[] {
    const stops: ShadowStop[] = []
    for (let distance = 0; distance <= radius + STEP / 2; distance += STEP) {
        const reached = Math.min(distance, radius)
        // The last stop is clear, so the fill's own edge never shows.
        const opacity = reached === radius ? 0 : round(covered(reached - outer))
        const last = stops.at(-1)
        const beforeLast = stops.at(-2)
        if (last?.opacity === opacity && beforeLast?.opacity === opacity) stops.pop()
        stops.push({ offset: round(reached / radius), opacity })
    }
    return stops
}

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
