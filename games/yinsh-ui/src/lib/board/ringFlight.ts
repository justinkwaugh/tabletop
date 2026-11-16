// A ring in flight, as LYNGK's claimed colours move: it lifts, arcs over, touches down a little
// short of its place, skips once and slides in. Distances are on the board's plane, heights
// above it, both in board units.

// Fractions of the flight: lift, fly, skip, then the slide to the end.
const LIFT_END = 0.16
const FLY_END = 0.68
const SKIP_END = 0.84
// The lift clears the marker left in the hole; the arc rises a little more on a longer flight.
const LIFT = 10
const ARC = { base: 14, perUnit: 0.03 }
const TOUCHDOWN = 16
const HOP = 4
const SLIDE = 6
const SWELL = 0.04
// Undo and history: one quick low arc, no skip.
const QUICK_ARC = 8

export type FlightPose = {
    // How far along the path the ring is.
    along: number
    // How high above the board its base is.
    lift: number
    scale: number
}

const easeOut = (t: number) => 1 - (1 - t) ** 2
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2

// The ring's pose at progress `u` (0 to 1) of a flight `length` long.
export function flightPose(u: number, length: number, quick = false): FlightPose {
    if (quick) {
        return { along: length * easeInOut(u), lift: QUICK_ARC * 4 * u * (1 - u), scale: 1 }
    }
    const touchdown = Math.max(0, length - Math.min(TOUCHDOWN, length / 3))
    const slideStart = Math.max(0, length - Math.min(SLIDE, length / 8))
    if (u < LIFT_END) {
        return { along: 0, lift: LIFT * easeOut(u / LIFT_END), scale: 1 }
    }
    if (u < FLY_END) {
        const t = easeInOut((u - LIFT_END) / (FLY_END - LIFT_END))
        const arc = ARC.base + ARC.perUnit * length
        return {
            along: touchdown * t,
            lift: LIFT * (1 - t) + 4 * arc * t * (1 - t),
            scale: 1 + SWELL * 4 * t * (1 - t)
        }
    }
    if (u < SKIP_END) {
        const t = (u - FLY_END) / (SKIP_END - FLY_END)
        return {
            along: touchdown + (slideStart - touchdown) * t,
            lift: HOP * 4 * t * (1 - t),
            scale: 1
        }
    }
    const t = easeOut((u - SKIP_END) / (1 - SKIP_END))
    return { along: slideStart + (length - slideStart) * t, lift: 0, scale: 1 }
}

// The progress at which the ring first passes `distance` along its path.
export function progressAt(distance: number, length: number, quick = false): number {
    const steps = 200
    for (let step = 0; step <= steps; step++) {
        if (flightPose(step / steps, length, quick).along >= distance) return step / steps
    }
    return 1
}
