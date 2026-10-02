import {
    citizensMeetingSuccessorGoal,
    endDieThreshold,
    type HydratedOathGameState
} from '@tabletop/oath'

/** R-3.3, R-3.3.1 — what the end die decides, read from the engine's own rules. */
export interface EndDieStakes {
    round: number
    /** The lowest roll that ends the game, as the sentence says it. */
    threshold: string
    winnerId: string
    /** How the winner wins, from the viewer's side of the table. */
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
        threshold: threshold === 6 ? '6' : `${threshold} or higher`,
        winnerId,
        as
    }
}
