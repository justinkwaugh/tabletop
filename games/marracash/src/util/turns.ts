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
    if (gameState.turnActions.at(-1) !== TurnAction.Move) {
        queueTurnCommit(context)
    }
    return MachineState.ConfirmingTurn
}

export function finishTurn(gameState: HydratedMarracashGameState): MachineState {
    return gameState.finishTurn().gameOver ? MachineState.EndOfGame : MachineState.ChoosingAction
}
