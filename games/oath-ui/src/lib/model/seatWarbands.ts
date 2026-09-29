import type { Color } from '@tabletop/common'
import {
    IMPERIAL_COLOR,
    countOf,
    PlayerStatus,
    availableImperialWarbands,
    warbandsOnBoardOf,
    type HydratedOathGameState
} from '@tabletop/oath'

export type SeatWarbands = { color: Color; onBoard: number; inBank: number }

/** R-6.6.3 — an Imperial seat fights with purple from the shared bank; an Exile with their own. */
export function seatWarbands(state: HydratedOathGameState, playerId: string): SeatWarbands {
    const seat = state.getPlayerState(playerId)
    if (seat.status !== PlayerStatus.Exile) {
        return {
            color: IMPERIAL_COLOR,
            onBoard: warbandsOnBoardOf(state, playerId),
            inBank: availableImperialWarbands(state)
        }
    }
    return {
        color: seat.color,
        onBoard: countOf(seat.warbandsOnBoard, seat.color),
        inBank: countOf(seat.warbandsInPersonalBank, seat.color)
    }
}
