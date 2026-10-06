import type { MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { type HydratedMarracashGameState } from '../model/gameState.js'
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
    queueTurnCommit(context)
    return MachineState.EndingTurn
}

// An auction leaves no one active, so the turn's later steps restore the turn player.
export function activateTurnPlayer(gameState: HydratedMarracashGameState) {
    gameState.activePlayerIds = [gameState.turnPlayerId()]
}

export function finishTurn(gameState: HydratedMarracashGameState): MachineState {
    return gameState.finishTurn().gameOver ? MachineState.EndOfGame : MachineState.ChoosingAction
}
