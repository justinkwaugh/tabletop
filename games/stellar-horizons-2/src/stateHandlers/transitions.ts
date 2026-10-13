import { isEvenDecade } from '../components/scenarios.js'
import { MachineState } from '../definition/states.js'
import { anyAnomalyAttempts } from '../model/anomalies.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { playersWithEarnedMarkers } from '../model/settlement.js'
import { anyPendingSurveys } from '../model/surveys.js'
import { terraformingPlayers } from '../model/terraforming.js'
import { TurnPhase } from '../model/turn.js'
import { branchingState, phaseAfter } from '../model/turnPlan.js'

export function stateAfterPhase(
    state: HydratedStellarHorizonsGameState,
    phase: TurnPhase
): MachineState {
    return phase === TurnPhase.Exploration
        ? stateAfterExploring(state)
        : stateOfNextPhase(state, phase)
}

function stateOfNextPhase(state: HydratedStellarHorizonsGameState, phase: TurnPhase): MachineState {
    const next = phaseAfter(state, phase)
    return next === undefined ? stateAfterLastPhase(state) : branchingState(next)
}

export function stateAfterExploring(state: HydratedStellarHorizonsGameState): MachineState {
    return playersWithEarnedMarkers(state).length > 0
        ? MachineState.SettlingExplorations
        : stateAfterSettlement(state)
}

export function stateAfterSettlement(state: HydratedStellarHorizonsGameState): MachineState {
    return anyAnomalyAttempts(state) ? MachineState.ResolvingAnomalies : stateAfterAnomalies(state)
}

export function stateAfterAnomalies(state: HydratedStellarHorizonsGameState): MachineState {
    return anyPendingSurveys(state) ? MachineState.ResolvingSurveys : stateAfterSurveys(state)
}

export function stateAfterSurveys(state: HydratedStellarHorizonsGameState): MachineState {
    return stateOfNextPhase(state, TurnPhase.Exploration)
}

function stateAfterLastPhase(state: HydratedStellarHorizonsGameState): MachineState {
    if (!state.scenarioDefinition().terraforming || !isEvenDecade(state.year)) {
        return MachineState.EndOfTurn
    }
    state.terraformQueue = terraformingPlayers(state)
    return state.terraformQueue.length > 0 ? MachineState.Terraforming : MachineState.EndOfTurn
}

export function stateAfterTerraformer(state: HydratedStellarHorizonsGameState): MachineState {
    state.terraformQueue = state.terraformQueue.slice(1)
    return state.terraformQueue.length > 0 ? MachineState.Terraforming : MachineState.EndOfTurn
}
