import { HydratedBusGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'

const ActionOrder = [MachineState.LineExpansion, MachineState.IncreaseBuses, MachineState.AddingPassengers]

export function getNextActionState(state: HydratedBusGameState): MachineState {
    let nextActionIndex = ActionOrder.findIndex((s) => s === state.machineState) + 1

    while (nextActionIndex < ActionOrder.length) {
        switch (ActionOrder[nextActionIndex]) {
            case MachineState.LineExpansion: {
                if (state.lineExpansionAction.length > 0) {
                    return MachineState.LineExpansion
                }
                break
            }
            case MachineState.IncreaseBuses: {
                if (state.busAction) {
                    return MachineState.IncreaseBuses
                }
                break
            }
            case MachineState.AddingPassengers: {
                if (state.passengersAction) {
                    return MachineState.AddingPassengers
                }
                break   
            }
        }

        nextActionIndex += 1
    }

    return MachineState.ChoosingActions
}
