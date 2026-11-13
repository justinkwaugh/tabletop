import { tick } from 'svelte'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { isTakeShare, supplyOf, type HydratedRideTheRailsGameState } from '@tabletop/ride-the-rails'
import {
    STRIP_LOCOMOTIVE,
    stripLocomotivePoint,
    turnOrderMarkerPoint
} from '$lib/utils/marginLayout.js'
import { shareChanges } from './flightPlan.js'
import { sharesKey, supplyKey, type Flights } from './flights.svelte.js'
import { FLIGHT, PoseTween, motionMode, pose, tickAt } from './motion.js'

type State = HydratedRideTheRailsGameState
type Step = Parameters<GameStateChangeListener<State>>[0]

export const SHARE_FLYER_KEY = 'share'

/**
 * Contract, Animation plan, Share (Patterns B and D): R-3.1, a locomotive lifts from its
 * railroad's strip entry and flies to the seat's turn-order marker; the strip's supply ticks as it
 * lifts and the seat's share count as it lands. Without an action the counts change with the state.
 */
export function shareAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from || !isTakeShare(action) || motionMode(flights, action) !== 'cinematic') return
        const change = shareChanges(from, to).find(
            (share) => share.playerId === action.playerId && share.railroadId === action.railroadId
        )
        if (!change) return
        flights.follow(animationContext)

        const start = stripLocomotivePoint(from.mapId, change.railroadId)
        const marker = turnOrderMarkerPoint(from.turnManager.turnOrder, change.playerId)
        const startPose = pose(start.x, start.y)
        flights.show([
            {
                key: SHARE_FLYER_KEY,
                kind: 'locomotive',
                railroadId: change.railroadId,
                width: STRIP_LOCOMOTIVE.width,
                pose: startPose
            }
        ])
        await tick()
        if (flights.interrupted) return

        const supply = supplyOf(to, change.railroadId)
        tickAt(animationContext, flights, supplyKey(change.railroadId), supply, 0)
        new PoseTween(flights, animationContext, SHARE_FLYER_KEY, startPose)
            .to({ y: start.y - 8, scale: 1.12 }, FLIGHT.lift, 0, 'power1.out')
            .to({ x: marker.x, y: marker.y, scale: 0.6 }, FLIGHT.fly, FLIGHT.lift)
            .to({ scale: 0.4, opacity: 0 }, FLIGHT.fade, FLIGHT.lands)
        const shares = sharesKey(change.playerId, change.railroadId)
        tickAt(animationContext, flights, shares, change.shares, FLIGHT.lands)
        animationContext.afterAnimations(() => flights.remove([SHARE_FLYER_KEY]))
    }
}
