import { assertExists } from '@tabletop/common'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'

// R-2.1, R-6.1
export const ROUND_COUNT = 6

export function currentRoundNumber(state: HydratedRideTheRailsGameState): number {
    const round = state.roundManager.currentRound
    assertExists(round, 'The end of a round needs a current round')
    return round.number
}

// R-6.1: round 6 ends the game in place of its end of round.
export function isLastRound(state: HydratedRideTheRailsGameState): boolean {
    return currentRoundNumber(state) === ROUND_COUNT
}

// R-2.5.1: lowest money first; tied players, however many, reverse their order from
// the round just played, so the stable sort runs over that order reversed.
export function turnOrderByMoney(state: HydratedRideTheRailsGameState): string[] {
    return [...state.turnManager.turnOrder]
        .reverse()
        .sort((a, b) => state.getPlayerState(a).money - state.getPlayerState(b).money)
}
