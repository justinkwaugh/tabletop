import { untrack } from 'svelte'
import type { RideTheRailsGameSession } from '$lib/model/session.svelte.js'
import { endOfRoundAnimator } from './endOfRoundAnimator.js'
import { journeyAnimator } from './journeyAnimator.js'
import { placementAnimator } from './placementAnimator.js'
import { shareAnimator } from './shareAnimator.js'
import { transcontinentalAnimator } from './transcontinentalAnimator.js'

/** Registers the flight layer's state-change animators; the returned call removes them. */
export function registerFlightAnimators(session: RideTheRailsGameSession): () => void {
    const listeners = [
        shareAnimator(session.flights),
        placementAnimator(session.flights),
        transcontinentalAnimator(session.flights, () => session.wantsTranscontinentalLine),
        journeyAnimator(
            session.flights,
            (playerId) => playerId === session.myPlayerId && !session.isViewingHistory
        ),
        endOfRoundAnimator(session.flights)
    ]
    for (const listener of listeners) session.addGameStateChangeListener(listener)
    return () => {
        for (const listener of listeners) session.removeGameStateChangeListener(listener)
    }
}

/** An attachment for the flight layer: animators while it is mounted, nothing left after it. */
export function attachFlights(session: RideTheRailsGameSession) {
    return () => {
        const unregister = untrack(() => registerFlightAnimators(session))
        return () => {
            unregister()
            session.flights.teardown()
        }
    }
}
