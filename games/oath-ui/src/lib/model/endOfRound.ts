import {
    citizensMeetingSuccessorGoal,
    endDieThreshold,
    type HydratedOathGameState
} from '@tabletop/oath'

/** R-3.3, R-3.3.1 — what the end die decides, read from the engine's own rules. */
export interface EndDieStakes {
    round: number
    threshold: string
    winnerId: string
    as: string
}

export function endDieStakes(
    state: HydratedOathGameState,
    viewerId: string | undefined
): EndDieStakes | undefined {
    const threshold = endDieThreshold(state.round)
    if (threshold === undefined) return undefined
    const chancellorId = state.chancellorId()
    const [successorId] = citizensMeetingSuccessorGoal(state)
    const winnerId = successorId ?? chancellorId
    const as =
        successorId === undefined
            ? 'as the Chancellor'
            : viewerId === chancellorId
              ? 'as your Successor'
              : 'as the Successor'
    return {
        round: state.round,
        threshold: endDieRollWords(threshold),
        winnerId,
        as
    }
}

/** R-3.3 — round five ends only on a 6; rounds six and seven on that roll or higher. */
export function endDieRollWords(threshold: number): string {
    return threshold === 6 ? '6' : `${threshold} or higher`
}
