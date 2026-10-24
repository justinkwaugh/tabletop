import { HydratedDvonnGameState } from '../model/gameState.js'

export type NextTurn = {
    playerId?: string
    passedPlayerId?: string
}

// Rules E8 and G1: a player without a move passes while the other plays on; the game ends once
// neither can move.
function nextTurnFrom(state: HydratedDvonnGameState, candidateId: string): NextTurn {
    if (state.canMove(candidateId)) {
        return { playerId: candidateId }
    }
    const otherId = state.opponentOf(candidateId)
    if (state.canMove(otherId)) {
        return { playerId: otherId, passedPlayerId: candidateId }
    }
    return {}
}

export function nextTurnAfterMove(state: HydratedDvonnGameState, moverId: string): NextTurn {
    return nextTurnFrom(state, state.opponentOf(moverId))
}

// Rule E1: White, who placed the last piece, also makes the first move.
export function firstMovingTurn(state: HydratedDvonnGameState): NextTurn {
    return nextTurnFrom(state, state.whitePlayerId())
}
