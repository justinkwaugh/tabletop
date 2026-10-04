import { isEvenDecade } from '../components/scenarios.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { terraformingPlayers } from '../model/terraforming.js'

export function stateAfterTurnActions(state: HydratedStellarHorizonsGameState): MachineState {
    if (state.pendingSurveys.length > 0) {
        return MachineState.ResolvingSurveys
    }
    return stateAfterSurveys(state)
}

export function stateAfterSurveys(state: HydratedStellarHorizonsGameState): MachineState {
    if (!isEvenDecade(state.year)) {
        return MachineState.EndOfTurn
    }
    state.terraformQueue = terraformingPlayers(state)
    return state.terraformQueue.length > 0 ? MachineState.Terraforming : MachineState.EndOfTurn
}

export function stateAfterTerraformer(state: HydratedStellarHorizonsGameState): MachineState {
    state.terraformQueue = state.terraformQueue.slice(1)
    return state.terraformQueue.length > 0 ? MachineState.Terraforming : MachineState.EndOfTurn
}
