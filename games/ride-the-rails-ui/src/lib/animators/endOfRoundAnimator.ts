import { tick } from 'svelte'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import type { HydratedRideTheRailsGameState } from '@tabletop/ride-the-rails'
import { STRIP_VEIL_OPACITY, roundTicketPoint } from '$lib/utils/marginLayout.js'
import { markerKey, veilKey, type Flights } from './flights.svelte.js'
import { markerSlides, railroadsMadeAvailable, roundStep } from './journeyPlan.js'
import { END_OF_ROUND, PoseTween, QUICK, motionMode, pose, tweenNumbers } from './motion.js'

type State = HydratedRideTheRailsGameState
type Step = Parameters<GameStateChangeListener<State>>[0]

export const ROUND_MARKER_KEY = 'round-marker'

/** Where each part of the end of round starts and how long it takes, in seconds. */
export type EndOfRoundTiming = {
    slide: number
    slideArc: number
    stepsAt: number
    step: number
    brightensAt: number
    brighten: number
}

/** Without an action every part starts at once and lands within the platform's 200 ms. */
export const QUICK_END_OF_ROUND: EndOfRoundTiming = {
    slide: QUICK.pop,
    slideArc: 0,
    stepsAt: 0,
    step: QUICK.pop,
    brightensAt: 0,
    brighten: QUICK.pop
}

/**
 * Contract, Animation plan, End of round (Pattern A): R-2.5. The end of round is its own action,
 * presented as the step after the last journey's, so it plays once the journey's motion has
 * played, at its own explicit positions: the turn-order markers slide to the new order, the round
 * marker steps to the next ticket, then the strip entry of the railroad made available brightens.
 * The markers and the veil are the board's own elements, tweened in place and given back their
 * attributes when the new state is shown. Without an action (Undo, state-only history), with
 * reduced motion, or when one step carries the last journey and the end of round together, every
 * part starts at 0 and lands within 200 ms.
 */
export function endOfRoundAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from) return
        const mode = motionMode(flights, action)
        if (mode === 'still') return
        const slides = markerSlides(from, to)
        const step = roundStep(from, to)
        const brightened = railroadsMadeAvailable(from, to)
        if (slides.length === 0 && !step && brightened.length === 0) return
        flights.follow(animationContext)
        const timing = mode === 'cinematic' ? END_OF_ROUND : QUICK_END_OF_ROUND

        if (step) {
            const ticket = roundTicketPoint(step.from)
            flights.show([{ key: ROUND_MARKER_KEY, kind: 'round', pose: pose(ticket.x, ticket.y) }])
            await tick()
            if (flights.interrupted) return
        }

        // R-2.5.1: each marker slides along the track, rising past the others when it moves
        // earlier and dipping when it moves later.
        for (const slide of slides) {
            const key = markerKey(slide.playerId)
            const offset = { x: 0, y: 0 }
            const write = () =>
                flights.write(key, 'transform', `translate(${offset.x} ${offset.y})`)
            const half = timing.slide / 2
            const arc = Math.sign(slide.to.x - slide.from.x) * timing.slideArc
            tweenNumbers(
                animationContext,
                offset,
                { x: slide.to.x - slide.from.x },
                { duration: timing.slide, position: 0 },
                write
            )
            if (arc !== 0) {
                tweenNumbers(
                    animationContext,
                    offset,
                    { y: arc },
                    { duration: half, position: 0, ease: 'power1.out' },
                    write
                )
                tweenNumbers(
                    animationContext,
                    offset,
                    { y: 0 },
                    { duration: half, position: half, ease: 'power1.in' },
                    write
                )
            }
        }

        // R-2.5.2: the round marker steps to the next ticket.
        if (step) {
            const start = roundTicketPoint(step.from)
            const target = roundTicketPoint(step.to)
            const hop = timing.slideArc
            const marker = new PoseTween(
                flights,
                animationContext,
                ROUND_MARKER_KEY,
                pose(start.x, start.y)
            )
            marker.to({ x: target.x }, timing.step, timing.stepsAt)
            if (hop > 0) {
                const half = timing.step / 2
                marker
                    .to({ y: start.y - hop }, half, timing.stepsAt, 'power1.out')
                    .to({ y: target.y }, half, timing.stepsAt + half, 'power1.in')
            }
        }

        // R-2.5.3: the veil over the newly available railroad's strip entry lifts.
        for (const railroadId of brightened) {
            const key = veilKey(railroadId)
            const veil = { opacity: STRIP_VEIL_OPACITY }
            tweenNumbers(
                animationContext,
                veil,
                { opacity: 0 },
                { duration: timing.brighten, position: timing.brightensAt, ease: 'power1.out' },
                () => flights.write(key, 'fill-opacity', String(veil.opacity))
            )
        }
    }
}
