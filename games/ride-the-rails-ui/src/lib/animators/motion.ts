import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { writePose, type Flights, type Pose } from './flights.svelte.js'

/** Players who ask for less motion get the quick changes Undo uses, as the platform's games do. */
export function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

/**
 * How a step moves: `cinematic` with the action that caused it, `quick` without one (Undo,
 * state-only history), with reduced motion, and `still` once an interruption has ended the motion.
 */
export type MotionMode = 'cinematic' | 'quick' | 'still'

export function motionMode(flights: Flights, action: GameAction | undefined): MotionMode {
    if (flights.interrupted) return 'still'
    return action && !prefersReducedMotion() ? 'cinematic' : 'quick'
}

/** Seconds. A quick step stays within the 200 ms the platform allows a step without an action. */
export const QUICK = { pop: 0.15 }

/** Seconds, from the start of the step's action timeline. */
export const FLIGHT = {
    lift: 0.14,
    fly: 0.5,
    /** When a flying locomotive reaches its hex or marker. */
    lands: 0.64,
    bounce: 0.12,
    settle: 0.14,
    coinRise: 0.16,
    coinFly: 0.44,
    coinStagger: 0.1,
    fade: 0.12
}

export function pose(x: number, y: number, scale = 1, opacity = 1): Pose {
    return { x, y, scale, opacity }
}

/**
 * Contract, Animation plan: SVG motion tweens a plain point and writes `translate(...)` on the
 * flyer's centred outer wrapper. One pose object per flyer, so its tweens follow on from each
 * other; every tween has an explicit position.
 */
export class PoseTween {
    private readonly current: Pose

    constructor(
        private readonly flights: Flights,
        private readonly animationContext: AnimationContext,
        private readonly key: string,
        start: Pose
    ) {
        this.current = { ...start }
    }

    to(target: Partial<Pose>, duration: number, position: number, ease = 'power2.inOut'): this {
        this.animationContext.actionTimeline.to(
            this.current,
            {
                ...target,
                duration,
                ease,
                onUpdate: () => writePose(this.flights.element(this.key), this.current)
            },
            position
        )
        return this
    }
}

/** A count ticks to its new value at a set moment of the step. */
export function tickAt(
    animationContext: AnimationContext,
    flights: Flights,
    key: string,
    value: number,
    position: number
) {
    animationContext.actionTimeline.call(() => flights.tick(key, value), [], position)
}

/**
 * Seconds. Contract, Animation plan, Journey: the passenger travels about 120 ms a hex, the whole
 * route capped at 2.4 s; each city it reaches pulses once; then the coins fly together.
 */
export const JOURNEY = {
    perHex: 0.12,
    travelCap: 2.4,
    pulse: 0.36,
    fade: 0.12,
    coinRise: 0.16,
    coinFly: 0.5,
    /** How far apart the coins fan out above the end city, in board units. */
    coinSpread: 26
}

/**
 * Seconds, from the start of the end of round's step. Contract, Animation plan, End of round:
 * the turn-order markers slide, the round marker steps, then the new railroad's entry brightens.
 */
export const END_OF_ROUND = {
    slide: 0.6,
    /** How far a marker rises or dips as it passes the others, in board units. */
    slideArc: 14,
    stepsAt: 0.3,
    step: 0.45,
    brightensAt: 0.6,
    brighten: 0.4
}

/**
 * Pattern A: tweens plain numbers and writes them on one of the board's own elements at each
 * frame, never through reactive state; the element gets its attributes back with the new state.
 */
export function tweenNumbers<V extends Record<string, number>>(
    animationContext: AnimationContext,
    values: V,
    target: Partial<V>,
    {
        duration,
        position,
        ease = 'power2.inOut'
    }: { duration: number; position: number; ease?: string },
    write: (values: V) => void
) {
    animationContext.actionTimeline.to(
        values,
        { ...target, duration, ease, onUpdate: () => write(values) },
        position
    )
}
