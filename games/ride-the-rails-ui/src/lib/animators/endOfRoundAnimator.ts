import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { ROUND_KEY, railroadEntryKey, roundTicketKey, type Flights } from './flights.svelte.js'
import { railroadsMadeAvailable, roundStep } from './journeyPlan.js'
import {
    END_OF_ROUND,
    QUICK,
    motionMode,
    tickAt,
    tweenNumbers,
    type State,
    type Step
} from './motion.js'

/** Without an action every part starts at once and lands within the platform's 200 ms. */
const QUICK_END_OF_ROUND: typeof END_OF_ROUND = {
    stepsAt: 0,
    step: QUICK.pop,
    hop: 0,
    brightensAt: 0,
    brighten: QUICK.pop
}

/**
 * Contract, Animation plan, End of round (Pattern A): R-2.5. The end of round is its own action,
 * presented as the step after the last journey's, so it plays once the journey's motion has
 * played, at its own explicit positions: the next round's ticket in the turn line hops and the
 * table shows the next round at the top of its hop; then the desktop card of the railroad made
 * available brightens in (a phone has no cards: the railroad is among the next share buttons). Each is the table's own element, tweened in place and
 * given back its style when the new state is shown. Without an action (Undo, state-only history),
 * with reduced motion, or when one step carries the last journey and the end of round together,
 * every part starts at 0 and lands within 200 ms. Phones show no tickets; their turn line names
 * the round.
 */
export function endOfRoundAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from) return
        const mode = motionMode(flights, action)
        if (mode === 'still') return
        const step = roundStep(from, to)
        if (!step) return
        flights.follow(animationContext)
        const timing = mode === 'cinematic' ? END_OF_ROUND : QUICK_END_OF_ROUND
        const half = timing.step / 2

        // R-2.5.2: the next round's ticket hops, and the round steps at the top of its hop.
        const ticket = { lift: 0, scale: 1 }
        const writeTicket = () =>
            flights.write(
                roundTicketKey(step.to),
                'style',
                `transform: translateY(${-ticket.lift}px) scale(${ticket.scale})`
            )
        tweenNumbers(
            animationContext,
            ticket,
            { lift: timing.hop, scale: 1.2 },
            { duration: half, position: timing.stepsAt, ease: 'power1.out' },
            writeTicket
        )
        tweenNumbers(
            animationContext,
            ticket,
            { lift: 0, scale: 1 },
            { duration: half, position: timing.stepsAt + half, ease: 'power1.in' },
            writeTicket
        )
        tickAt(animationContext, flights, ROUND_KEY, step.to, timing.stepsAt + half)

        // R-2.5.3, R-1.4: the railroad made available joins the cards as the round steps (drawn
        // unseen until now), and brightens in.
        for (const railroadId of railroadsMadeAvailable(from, to)) {
            const entry = { opacity: 0 }
            tweenNumbers(
                animationContext,
                entry,
                { opacity: 1 },
                { duration: timing.brighten, position: timing.brightensAt, ease: 'power1.out' },
                () =>
                    flights.write(
                        railroadEntryKey(railroadId),
                        'style',
                        `opacity: ${entry.opacity}`
                    )
            )
        }
    }
}
