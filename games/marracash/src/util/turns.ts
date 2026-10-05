import type { MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { TurnAction, type HydratedMarracashGameState } from '../model/gameState.js'
import { queueTurnCommit } from './automaticActions.js'

export function stateAfterTurnAction(
    context: MachineContext<HydratedMarracashGameState>
): MachineState {
    const gameState = context.gameState
    if (gameState.canAct(gameState.turnPlayerId())) {
        return MachineState.ChoosingAction
    }
    if (gameState.needsRefill()) {
        return MachineState.RefillingEntrances
    }
    // Games from 0.1.0 wait for the player to confirm a turn that ends on a move.
    if (gameState.undoStopsOnlyAtReveals || gameState.turnActions.at(-1) !== TurnAction.Move) {
        queueTurnCommit(context)
    }
    return MachineState.ConfirmingTurn
}

// An auction leaves no one active, so the turn's later steps restore the turn player.
export function activateTurnPlayer(gameState: HydratedMarracashGameState) {
    gameState.activePlayerIds = [gameState.turnPlayerId()]
}

export function finishTurn(gameState: HydratedMarracashGameState): MachineState {
    return gameState.finishTurn().gameOver ? MachineState.EndOfGame : MachineState.ChoosingAction
}
