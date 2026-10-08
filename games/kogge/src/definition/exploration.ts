import {
    assert,
    shuffle,
    type ExplorationPopulation,
    type GameExploration,
    type RandomFunction
} from '@tabletop/common'
import { MAX_OFFICES_PER_CITY } from '../components/cities.js'
import {
    allRouteMarkers,
    sortMarkers,
    startingHand,
    withoutMarkers
} from '../components/routeMarkers.js'
import type { KoggeProjectedState } from '../model/gameState.js'
import { MachineState } from './states.js'

export class KoggeGameExploration implements GameExploration<KoggeProjectedState> {
    createFromCanonicalState(state: KoggeProjectedState): KoggeProjectedState {
        return state
    }

    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<KoggeProjectedState>): KoggeProjectedState {
        const sampled = structuredClone(state)
        if (sampled.startChoices !== undefined) {
            fillStartingHands(sampled)
        }
        const pool = unknownMarkers(sampled)
        shuffle(pool, random)
        for (const player of sampled.players) {
            if (player.markers === undefined) {
                player.markers = sortMarkers(pool.splice(0, player.markerCount))
            }
        }
        for (const city of sampled.cities) {
            for (const slot of city.routes) {
                if (slot.hidden !== undefined && slot.hidden.value === undefined) {
                    const index = pool.findIndex((value) => value !== city.number)
                    assert(index >= 0, 'No hypothetical marker fits a hidden route')
                    slot.hidden.value = pool.splice(index, 1)[0]
                }
            }
        }
        assert(pool.length === sampled.reserve.remaining, 'Hidden route markers do not add up')
        sampled.reserve.items = pool
        sampleStartChoices(sampled, random)
        return sampled
    }
}

// Rulebook setup: every hand is 0 to 8 until the start office is founded with one of them.
function fillStartingHands(state: KoggeProjectedState) {
    for (const player of state.players) {
        if (player.markers === undefined) {
            const founded = player.city === undefined ? [] : [player.city]
            player.markers = withoutMarkers(startingHand(), founded)
        }
    }
}

function unknownMarkers(state: KoggeProjectedState): number[] {
    const bidsOnTable = state.machineState === MachineState.Bidding
    const known = [
        ...state.players.flatMap((player) => player.markers ?? []),
        ...state.cities.flatMap((city) =>
            city.routes.flatMap((slot) => {
                const value = slot.value ?? slot.hidden?.value
                return value === undefined ? [] : [value]
            })
        ),
        ...state.offer.flatMap((group) => (group.boughtBy === undefined ? group.markers : [])),
        ...(bidsOnTable ? state.bids.flatMap((bid) => bid.markers) : [])
    ]
    return withoutMarkers(allRouteMarkers(), known)
}

function sampleStartChoices(state: KoggeProjectedState, random: RandomFunction) {
    for (const choice of state.startChoices ?? []) {
        if (!choice.submitted || choice.city !== undefined) {
            continue
        }
        const options = state.cities.filter(
            (city) =>
                city.offices.length < MAX_OFFICES_PER_CITY && !choice.excluded.includes(city.number)
        )
        choice.city = options[Math.floor(random() * options.length)].number
    }
}
