import { gsap } from 'gsap'
import { PIECE_RADIUS, SPACING } from './geometry.js'

// Seen from the side, a moving stack hops in one arc over every space between, a little longer
// and higher the farther it goes. Undo and history hop quickly.
export const HOP = {
    single: 0.32,
    perSpace: 0.04,
    longest: 0.52,
    arc: 22,
    arcPerSpace: 3,
    // Over a stack taller than both ends, the hop tops out this far above it.
    overTall: 10,
    quick: 0.18
}
// How far the moving stack's underside clears the top of a stack it passes over.
const CLEARANCE = 3

export const RISE_EASE = 'power2.out'
export const FALL_EASE = 'power2.in'
export const GROUND_EASE = 'sine.inOut'

// How far apart, as a share of the spacing, two pieces stand when their footprints just touch.
const FOOTPRINT = (2 * PIECE_RADIUS) / SPACING
const SAMPLES = 100

// One hop, in seconds from its start and in screen units above the flier's space (negative is
// up). The flier rises to `peak` at `peakTime` and comes down to `endLift`; along the board it
// moves between `groundStart` and `groundEnd`, setting off as soon as it can without its footprint
// reaching a stack it passes over before it is higher than that stack, and arriving no later
// than it must to come down past them. It tops out over the middle of the hop, or over the stack
// that sets its height, so it never climbs again once past it.
export type HopPlan = {
    duration: number
    startLift: number
    endLift: number
    peak: number
    peakTime: number
    groundStart: number
    groundEnd: number
}

export type HopSpec = {
    spaces: number
    startLift: number
    endLift: number
    // The resting lift on top of each space the hop passes over, in order (0 for an empty one).
    over: readonly number[]
    quick: boolean
}

export function hopPlan({ spaces, startLift, endLift, over, quick }: HopSpec): HopPlan {
    const duration = quick
        ? HOP.quick
        : Math.min(HOP.single + HOP.perSpace * (spaces - 1), HOP.longest)
    const stacks = over.filter((rest) => rest < 0)
    const clear = Math.min(Infinity, ...stacks.map((rest) => rest - CLEARANCE))
    const arcPeak = Math.min(startLift, endLift) - HOP.arc - HOP.arcPerSpace * (spaces - 1)
    const peak = Math.min(arcPeak, clear - HOP.overTall)
    const plan = {
        duration,
        startLift,
        endLift,
        peak,
        peakTime: duration / 2,
        groundStart: 0,
        groundEnd: duration
    }
    if (clear === Infinity) return plan
    // How far along the stack that sets the height stands, when it does.
    const tallest = peak < arcPeak ? (over.indexOf(Math.min(...over)) + 1) / spaces : undefined
    // While its footprint overlaps a stack it passes over, it must be higher than that stack:
    // it sets off once it can, and arrives as late as it may.
    const step = duration / SAMPLES
    for (let tries = 0; tries < SAMPLES && plan.groundStart < plan.groundEnd; tries++) {
        if (tallest !== undefined) {
            const progress = Math.acos(1 - 2 * tallest) / Math.PI
            const time = plan.groundStart + progress * (plan.groundEnd - plan.groundStart)
            plan.peakTime = Math.min(Math.max(time, duration * 0.25), duration * 0.75)
        }
        let early = false
        let late = false
        for (let sample = 0; sample <= SAMPLES; sample++) {
            const time = sample * step
            const { along, lift } = hopAt(plan, time)
            const position = along * spaces
            const through = over.some(
                (rest, index) =>
                    rest < 0 &&
                    Math.abs(position - (index + 1)) < FOOTPRINT &&
                    lift > rest - CLEARANCE
            )
            if (!through) continue
            if (time < plan.peakTime) early = true
            else late = true
        }
        if (!early && !late) break
        if (early) plan.groundStart += step
        if (late) plan.groundEnd -= step
    }
    return plan
}

// Where the flier is `time` seconds into its hop: how far along the board (0 to 1) and how high.
export function hopAt(plan: HopPlan, time: number): { along: number; lift: number } {
    const { duration, startLift, endLift, peak, peakTime, groundStart, groundEnd } = plan
    const fall = duration - peakTime
    const lift =
        time < peakTime
            ? startLift + (peak - startLift) * gsap.parseEase(RISE_EASE)(time / peakTime)
            : peak +
              (endLift - peak) * gsap.parseEase(FALL_EASE)(Math.min(time - peakTime, fall) / fall)
    const span = groundEnd - groundStart
    const progress = Math.max(0, Math.min(1, (time - groundStart) / span))
    return { along: gsap.parseEase(GROUND_EASE)(progress), lift }
}
