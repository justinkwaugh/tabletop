import {
    Banner,
    bannerHolder,
    effectiveAdviserLimit,
    favorHomeBankOf,
    usableFavor,
    type HydratedOathGameState,
    type Suit
} from '@tabletop/oath'
import { seatWarbands, type SeatWarbands } from './seatWarbands.js'

export function bannersHeldBy(state: HydratedOathGameState, playerId: string): Banner[] {
    return Object.values(Banner).filter((banner) => bannerHolder(state, banner) === playerId)
}

export type SeatFacts = {
    warbands: SeatWarbands
    favor: number
    favorBank: Suit | undefined
    banners: Banner[]
    emptyAdviserSlots: number
    holdsOathkeeper: boolean
    isUsurper: boolean
}

/** One reading of a seat, shared by the seat card and the open seat. */
export function seatFacts(state: HydratedOathGameState, playerId: string): SeatFacts {
    const seat = state.getPlayerState(playerId)
    // R-2.11, R-2.11.a — the Usurper side is R-3.1's win condition.
    const holdsOathkeeper = state.oathkeeperPlayerId === playerId
    return {
        warbands: seatWarbands(state, playerId),
        favor: usableFavor(state, playerId),
        favorBank: favorHomeBankOf(state, playerId),
        banners: bannersHeldBy(state, playerId),
        emptyAdviserSlots: Math.max(
            0,
            effectiveAdviserLimit(state, playerId) - seat.advisers.length
        ),
        holdsOathkeeper,
        isUsurper: holdsOathkeeper && state.oathkeeperIsUsurper === true
    }
}
