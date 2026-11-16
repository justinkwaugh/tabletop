import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { EndReason, HydratedYinshGameState } from '../model/gameState.js'

export function turnHolder(state: HydratedYinshGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A ring moves only during a turn')
    return turn.playerId
}

// The next machine state, and the player passed over if the turn ends with a pass.
export type TurnEnd = { next: MachineState; passedPlayerId?: string }

// Rules G6 and G7: the mover takes their rows first, then the opponent takes theirs before moving.
export function startResolving(state: HydratedYinshGameState, moverId: string): TurnEnd {
    state.resolvingPlayerIds = [moverId, state.opponentOf(moverId)]
    return continueResolving(state)
}

export function continueResolving(state: HydratedYinshGameState): TurnEnd {
    while (state.resolvingPlayerIds.length > 0) {
        if (state.board.hasRow(state.resolvingPlayerIds[0])) {
            return { next: MachineState.RemovingRow }
        }
        state.resolvingPlayerIds.shift()
    }
    return endTurn(state)
}

// Rule H3 ends the game once the pool is empty; a player without a move passes, and when
// neither can move the game ends the same way.
function endTurn(state: HydratedYinshGameState): TurnEnd {
    const { turnManager } = state
    const holder = turnHolder(state)
    turnManager.endTurn(state.actionCount)
    if (state.markersInPool() === 0) {
        state.declareWinnerByRings(EndReason.PoolEmpty)
        return { next: MachineState.EndOfGame }
    }
    if (!state.players.some((player) => state.canMove(player.playerId))) {
        state.declareWinnerByRings(EndReason.NoMoves)
        return { next: MachineState.EndOfGame }
    }
    turnManager.startNextTurn(state.actionCount, (playerId) => state.canMove(playerId))
    const passed = turnHolder(state) === holder ? state.opponentOf(holder) : undefined
    return { next: MachineState.MovingRing, passedPlayerId: passed }
}
