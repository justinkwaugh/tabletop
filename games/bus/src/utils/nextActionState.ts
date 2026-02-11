import { HydratedBusGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'

function getNextActionState(state: HydratedBusGameState): MachineState {
    if (state.machineState === MachineState.ChoosingActions) {
        if (state.lineExpansionAction.length > 0) {
            return MachineState.LineExpansion
        }
    }
    return state.machineState
}
