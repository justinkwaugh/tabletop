import { MachineState } from '../definition/states.js'
import { EndReason, HydratedYinshGameState } from '../model/gameState.js'

// Rules G6 and G7: the mover takes their rows first, then the opponent takes theirs before moving.
export function startResolving(state: HydratedYinshGameState, moverId: string): MachineState {
    state.resolvingPlayerIds = [moverId, state.opponentOf(moverId)]
    return continueResolving(state)
}

export function continueResolving(state: HydratedYinshGameState): MachineState {
    while (state.resolvingPlayerIds.length > 0) {
        if (state.board.hasRow(state.resolvingPlayerIds[0])) {
            return MachineState.RemovingRow
        }
        state.resolvingPlayerIds.shift()
    }
    return endTurn(state)
}

// Rule H3 ends the game once the pool is empty; a player without a move passes, and when
// neither can move the game ends the same way.
function endTurn(state: HydratedYinshGameState): MachineState {
    const { turnManager } = state
    turnManager.endTurn(state.actionCount)
    if (state.markersInPool() === 0) {
        state.declareWinnerByRings(EndReason.PoolEmpty)
        return MachineState.EndOfGame
    }
    if (!state.players.some((player) => state.canMove(player.playerId))) {
        state.declareWinnerByRings(EndReason.NoMoves)
        return MachineState.EndOfGame
    }
    turnManager.startNextTurn(state.actionCount, (playerId) => state.canMove(playerId))
    return MachineState.MovingRing
}
