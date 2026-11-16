import { tick } from 'svelte'
import type { GameAction, Point } from '@tabletop/common'
import type { AnimationContext, GameStateChangeListener } from '@tabletop/frontend-components'
import type { HydratedRideTheRailsGameState } from '@tabletop/ride-the-rails'
import { writePose, type Flights, type Flyer, type Pose } from './flights.svelte.js'

export type State = HydratedRideTheRailsGameState
export type Step = Parameters<GameStateChangeListener<State>>[0]

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

/** Puts the flyers up and waits for them to mount; false when an interruption ended the step. */
export async function showFlyers(flights: Flights, flyers: readonly Flyer[]): Promise<boolean> {
    flights.show(flyers)
    await tick()
    return !flights.interrupted
}

/** A locomotive lifts from its railroad's strip entry, then flies to its target. */
export function liftAndFly(
    flights: Flights,
    animationContext: AnimationContext,
    key: string,
    start: Pose,
    target: Partial<Pose>
): PoseTween {
    return new PoseTween(flights, animationContext, key, start)
        .to({ y: start.y - 8, scale: start.scale * 1.12 }, FLIGHT.lift, 0, 'power1.out')
        .to(target, FLIGHT.fly, FLIGHT.lift)
}

export type CoinTiming = { coinRise: number; coinFly: number; fade: number }

// A coin is unseen where it is paid until it rises.
function unseenAt(start: Point): Pose {
    return pose(start.x, start.y, 1, 0)
}

export function coinFlyer(key: string, amount: number, gold: boolean, start: Point): Flyer {
    return { key, kind: 'coin', amount, gold, pose: unseenAt(start) }
}

/** When a coin that rises at `rises` lands on the seat's money. */
export function coinLands(rises: number, timing: CoinTiming): number {
    return rises + timing.coinRise + timing.coinFly
}

export type CoinFlight = {
    key: string
    /** Where the coin is paid, unseen until it rises. */
    start: Point
    rise: Partial<Pose>
    marker: Point
    rises: number
}

/** A coin rises where it is paid, flies to the seat's money and fades; returns when it lands. */
export function flyCoin(
    flights: Flights,
    animationContext: AnimationContext,
    { key, start, rise, marker, rises }: CoinFlight,
    timing: CoinTiming
): number {
    const lands = coinLands(rises, timing)
    new PoseTween(flights, animationContext, key, unseenAt(start))
        .to({ opacity: 1, ...rise }, timing.coinRise, rises, 'power1.out')
        .to(
            { x: marker.x, y: marker.y, scale: 0.7 },
            timing.coinFly,
            rises + timing.coinRise,
            'power2.in'
        )
        .to({ opacity: 0 }, timing.fade, lands)
    return lands
}

/**
 * Without an action, arriving flyers pop in to their poses and leaving ones shrink away; the
 * pieces they stand for are hidden while they do.
 */
export async function popFlyers(
    flights: Flights,
    animationContext: AnimationContext,
    { arriving, leaving, hidden }: { arriving: Flyer[]; leaving: Flyer[]; hidden: string[] }
) {
    const shrunk = (flyer: Flyer): Flyer => ({ ...flyer, pose: { ...flyer.pose, scale: 0 } })
    flights.hide(hidden)
    if (!(await showFlyers(flights, [...arriving.map(shrunk), ...leaving]))) return
    for (const flyer of arriving) {
        new PoseTween(flights, animationContext, flyer.key, shrunk(flyer).pose).to(
            { scale: flyer.pose.scale },
            QUICK.pop,
            0,
            'back.out(2)'
        )
    }
    for (const flyer of leaving) {
        new PoseTween(flights, animationContext, flyer.key, flyer.pose).to(
            { scale: 0, opacity: 0 },
            QUICK.pop,
            0,
            'power2.in'
        )
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
 * the round steps to the next ticket, then the railroad made available brightens in.
 */
export const END_OF_ROUND = {
    stepsAt: 0.3,
    step: 0.45,
    /** How high the next round's ticket hops as the round steps to it, in pixels. */
    hop: 7,
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
