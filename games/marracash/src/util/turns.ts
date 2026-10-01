import { MachineState } from '../definition/states.js'
import type { HydratedMarracashGameState } from '../model/gameState.js'

export function closeTurn(gameState: HydratedMarracashGameState): MachineState {
    if (gameState.needsRefill()) {
        return MachineState.RefillingEntrances
    }
    return gameState.finishTurn().gameOver ? MachineState.EndOfGame : MachineState.ChoosingAction
}
