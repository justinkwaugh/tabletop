import { assertExists, Color } from '@tabletop/common'
import { HydratedDvonnGameState } from '../model/gameState.js'

export function turnHolder(state: HydratedDvonnGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A piece is placed or a stack moved only during a turn')
    return turn.playerId
}

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

// Rule E1: White, who placed the last piece, also makes the first move, as White does once the
// board of I set, you choose is set.
export function firstMovingTurn(state: HydratedDvonnGameState): NextTurn {
    return nextTurnFrom(state, state.playerWith(Color.White))
}
