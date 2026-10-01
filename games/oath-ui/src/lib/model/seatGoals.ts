import {
    PlayerStatus,
    meetsRevealedVisionGoal,
    meetsSuccessorGoal,
    playersMeetingOathkeeperGoal,
    visionsMetBy,
    type HydratedOathGameState
} from '@tabletop/oath'
import { sharedVisionIdsOf } from './cardWarbands.js'

export type SeatGoal =
    | { kind: 'successor'; key: string; met: boolean }
    | { kind: 'oathkeeper'; key: string; met: boolean }
    | { kind: 'vision'; key: string; met: boolean; visionId: string; shared: boolean }

export type SeatVision = { visionId: string; shared: boolean }

/** R-3.2 — the seat's own revealed Vision, then the ones False Prophet shares with it. */
export function seatVisions(state: HydratedOathGameState, playerId: string): SeatVision[] {
    const own = state.getPlayerState(playerId).revealedVisionId
    const shared = sharedVisionIdsOf(state, playerId).map((visionId) => ({
        visionId,
        shared: true
    }))
    return own ? [{ visionId: own, shared: false }, ...shared] : shared
}

/** R-3.3.1 for a Citizen, R-3.1 and R-3.2 for an Exile, R-2.11 for the Chancellor. */
export function seatGoals(state: HydratedOathGameState, playerId: string): SeatGoal[] {
    const seat = state.getPlayerState(playerId)
    if (seat.status === PlayerStatus.Citizen) {
        return [{ kind: 'successor', key: 'successor', met: meetsSuccessorGoal(state, playerId) }]
    }
    const met = visionsMetBy(state, playerId)
    const goals: SeatGoal[] = seatVisions(state, playerId)
        .filter((vision) => vision.shared || seat.status === PlayerStatus.Exile)
        .map(
            ({ visionId, shared }): SeatGoal => ({
                kind: 'vision',
                key: visionId,
                visionId,
                shared,
                met: shared ? met.includes(visionId) : meetsRevealedVisionGoal(state, playerId)
            })
        )
    goals.push({
        kind: 'oathkeeper',
        key: 'oathkeeper',
        met: playersMeetingOathkeeperGoal(state).includes(playerId)
    })
    return goals
}
