import { assertExists } from '@tabletop/common'
import {
    LOCOMOTIVES_PER_RAILROAD,
    RAILROAD_INTRODUCTIONS,
    type RailroadId
} from '../data/railroads.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { trackCount } from './track.js'

// R-1.1: a locomotive is a share or track, never both; the rest is the supply.
export function supplyOf(state: HydratedRideTheRailsGameState, railroadId: RailroadId): number {
    const shares = state.players.reduce((sum, player) => sum + player.sharesOf(railroadId), 0)
    return LOCOMOTIVES_PER_RAILROAD - shares - trackCount(state.track, railroadId)
}

// R-1.1: an empty supply stops that railroad's shares and track.
export function hasSupply(state: HydratedRideTheRailsGameState, railroadId: RailroadId): boolean {
    return supplyOf(state, railroadId) > 0
}

// R-1.4: a railroad is available from the round shown, in R-1.4 order.
export function availableRailroads(state: HydratedRideTheRailsGameState): RailroadId[] {
    const round = state.roundManager.currentRound
    assertExists(round, 'Railroad availability needs a current round')
    return RAILROAD_INTRODUCTIONS[state.mapId]
        .filter((introduction) => introduction.availableFromRound <= round.number)
        .map((introduction) => introduction.railroadId)
}
