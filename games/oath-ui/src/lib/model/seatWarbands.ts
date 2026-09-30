import {
    IMPERIAL_WARBANDS,
    countOf,
    PlayerStatus,
    availableImperialWarbands,
    warbandsOnBoardOf,
    type HydratedOathGameState,
    type WarbandOwner
} from '@tabletop/oath'

export type SeatWarbands = { owner: WarbandOwner; onBoard: number; inBank: number }

/** R-6.6.3 — an Imperial seat fights with the Empire's warbands from the shared bank; an Exile with their own. */
export function seatWarbands(state: HydratedOathGameState, playerId: string): SeatWarbands {
    const seat = state.getPlayerState(playerId)
    if (seat.status !== PlayerStatus.Exile) {
        return {
            owner: IMPERIAL_WARBANDS,
            onBoard: warbandsOnBoardOf(state, playerId),
            inBank: availableImperialWarbands(state)
        }
    }
    return {
        owner: seat.playerId,
        onBoard: countOf(seat.warbandsOnBoard, seat.playerId),
        inBank: countOf(seat.warbandsInPersonalBank, seat.playerId)
    }
}
