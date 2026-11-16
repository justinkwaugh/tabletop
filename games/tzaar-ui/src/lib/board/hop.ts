// Seen from the side, a moving stack hops in one arc onto where it lands, a little longer and
// higher the farther it goes. A stack only ever moves over vacant spaces, so the arc need clear
// nothing between its ends.
export const HOP = {
    single: 0.32,
    perSpace: 0.04,
    longest: 0.52,
    arc: 22,
    arcPerSpace: 3
}

export const RISE_EASE = 'power2.out'
export const FALL_EASE = 'power2.in'
export const GROUND_EASE = 'sine.inOut'

// One hop, in screen units above the flier's space (negative is up): it rises from `startLift`
// to `peak` over the first half of `duration` and comes down to `endLift` over the second.
export type HopPlan = {
    duration: number
    startLift: number
    endLift: number
    peak: number
}

export type HopSpec = {
    // How many steps along the board the hop covers.
    spaces: number
    startLift: number
    endLift: number
    // The hop's length when it must be quick, or undefined to pace it by its distance.
    quick?: number
}

export function hopPlan({ spaces, startLift, endLift, quick }: HopSpec): HopPlan {
    const duration = quick ?? Math.min(HOP.single + HOP.perSpace * (spaces - 1), HOP.longest)
    const peak = Math.min(startLift, endLift) - HOP.arc - HOP.arcPerSpace * (spaces - 1)
    return { duration, startLift, endLift, peak }
}
