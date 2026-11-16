import type { RailroadId } from '../data/railroads.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { availableRailroads, hasSupply } from './supply.js'

export type ShareRefusal = 'not-available' | 'empty-supply'

// R-3.1, R-1.4, R-1.1: a share comes from an available railroad's supply.
export function shareRefusal(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId
): ShareRefusal | undefined {
    if (!availableRailroads(state).includes(railroadId)) {
        return 'not-available'
    }
    if (!hasSupply(state, railroadId)) {
        return 'empty-supply'
    }
    return undefined
}

// R-3.1, R-1.1: the railroads a share may be taken of, in R-1.4 order.
export function shareableRailroads(state: HydratedRideTheRailsGameState): RailroadId[] {
    return availableRailroads(state).filter((railroadId) => hasSupply(state, railroadId))
}

// R-3.1: phase 1's "must take" has nothing to take once every available supply is empty.
export function mustSkipShare(state: HydratedRideTheRailsGameState): boolean {
    return shareableRailroads(state).length === 0
}
