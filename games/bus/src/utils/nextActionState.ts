import { HydratedBusGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'

const ActionOrder = [
    MachineState.LineExpansion,
    MachineState.IncreaseBuses,
    MachineState.AddingPassengers,
    MachineState.AddingBuildings,
    MachineState.TimeMachine,
    MachineState.Vrooming,
    MachineState.SettingFirstPlayer
]

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
                if (state.passengersAction.length > 0) {
                    return MachineState.AddingPassengers
                }
                break
            }
            case MachineState.AddingBuildings: {
                if (state.buildingAction.length > 0) {
                    return MachineState.AddingBuildings
                }
                break
            }
            case MachineState.TimeMachine: {
                return MachineState.TimeMachine
            }
            case MachineState.Vrooming: {
                if (state.vroomAction.length > 0) {
                    return MachineState.Vrooming
                }
                break
            }
            case MachineState.SettingFirstPlayer: {
                if (state.startingPlayerAction) {
                    return MachineState.SettingFirstPlayer
                }
                break
            }
        }

        nextActionIndex += 1
    }

    return MachineState.ChoosingActions
}
