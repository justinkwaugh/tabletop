import type { GameStateChangeListener } from '@tabletop/frontend-components'
import { isTakeShare, supplyOf } from '@tabletop/ride-the-rails'
import { TRAVELLING_LOCOMOTIVE_WIDTH, railroadSourcePoint, seatCardPoint } from './flightPlaces.js'
import { shareChanges } from './flightPlan.js'
import { newShareSlot } from '$lib/utils/seatCards.js'
import { sharesKey, supplyKey, type Flights } from './flights.svelte.js'
import {
    FLIGHT,
    liftAndFly,
    motionMode,
    pose,
    showFlyers,
    tickAt,
    type State,
    type Step
} from './motion.js'

export const SHARE_FLYER_KEY = 'share'

/**
 * Contract, Animation plan, Share (Patterns B and D): R-3.1, a locomotive lifts from its
 * railroad's supply pile (its card on desktop, its share button on a phone) and flies to the
 * slot it fills on the seat's card; the pile loses a cube as it lifts and the seat's share count ticks as it lands
 * (`flightPlaces`). Without an action the counts change with the state.
 */
export function shareAnimator(flights: Flights): GameStateChangeListener<State> {
    return async ({ from, to, action, animationContext }: Step) => {
        if (!from || !isTakeShare(action) || motionMode(flights, action) !== 'cinematic') return
        const change = shareChanges(from, to).find(
            (share) => share.playerId === action.playerId && share.railroadId === action.railroadId
        )
        if (!change) return
        flights.follow(animationContext)

        const start = railroadSourcePoint(flights.table, change.railroadId)
        const taker = to.getPlayerState(change.playerId)
        const slot = newShareSlot((railroadId) => taker.sharesOf(railroadId), change.railroadId)
        const marker = seatCardPoint(flights.table, change.playerId, slot)
        const startPose = pose(start.x, start.y)
        const shown = await showFlyers(flights, [
            {
                key: SHARE_FLYER_KEY,
                kind: 'locomotive',
                railroadId: change.railroadId,
                width: TRAVELLING_LOCOMOTIVE_WIDTH,
                pose: startPose,
                leavesTheMap: true
            }
        ])
        if (!shown) return

        const supply = supplyOf(to, change.railroadId)
        tickAt(animationContext, flights, supplyKey(change.railroadId), supply, 0)
        liftAndFly(flights, animationContext, SHARE_FLYER_KEY, startPose, {
            x: marker.x,
            y: marker.y,
            scale: 0.6
        }).to({ scale: 0.4, opacity: 0 }, FLIGHT.fade, FLIGHT.lands)
        const shares = sharesKey(change.playerId, change.railroadId)
        tickAt(animationContext, flights, shares, change.shares, FLIGHT.lands)
        animationContext.afterAnimations(() => flights.remove([SHARE_FLYER_KEY]))
    }
}
