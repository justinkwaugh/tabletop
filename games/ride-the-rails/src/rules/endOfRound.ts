import { assertExists } from '@tabletop/common'
import type { CityId } from '../data/boardMap.js'
import type { MapId } from '../data/maps.js'
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

// R-8 (France, Paris Travels): the city that takes a new passenger at the end of each round if it
// has none; R-8: an expansion map adds its own row.
export const ROUND_END_PASSENGER_CITY: Readonly<Record<MapId, CityId | null>> = {
    'map.usa': null,
    'map.au': null,
    'map.ca': null,
    'map.fr': 'city.fr.paris',
    'map.de': null
}

// R-8: the city a passenger is placed in at the end of the round, if any.
export function roundEndPassenger(
    cityId: CityId | null,
    passengers: readonly CityId[]
): CityId | undefined {
    return cityId !== null && !passengers.includes(cityId) ? cityId : undefined
}
