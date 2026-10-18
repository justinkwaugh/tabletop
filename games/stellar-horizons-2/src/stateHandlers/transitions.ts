import { EconomicTile } from '../components/economicTiles.js'
import { isEvenDecade } from '../components/scenarios.js'
import { MachineState } from '../definition/states.js'
import { anyAnomalyAttempts } from '../model/anomalies.js'
import { isCampaign } from '../model/campaign.js'
import { converters } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { playersWithEarnedMarkers } from '../model/settlement.js'
import { anyPendingSurveys } from '../model/surveys.js'
import { refillWorldPool, terraformingQueue } from '../model/terraforming.js'
import { TurnPhase } from '../model/turn.js'
import { branchingState, firstPhase, phaseAfter } from '../model/turnPlan.js'

export function stateAfterPhase(
    state: HydratedStellarHorizonsGameState,
    phase: TurnPhase
): MachineState {
    switch (phase) {
        case TurnPhase.Exploration:
            return stateAfterExploring(state)
        case TurnPhase.Initiative:
            return MachineState.RollingInitiative
        case TurnPhase.BaseProduction:
            return MachineState.ProducingAtBases
        default:
            return stateOfNextPhase(state, phase)
    }
}

// Rulebook 4.0: the drawn tile decides what the campaign's economic phase does this turn.
export function stateForEconomicTile(
    state: HydratedStellarHorizonsGameState,
    tile: EconomicTile
): MachineState {
    switch (tile) {
        case EconomicTile.RollInitiative:
            return branchingState(TurnPhase.Initiative)
        case EconomicTile.BaseProduction:
            return branchingState(TurnPhase.BaseProduction)
        case EconomicTile.SettlementGrowth:
            return MachineState.GrowingSettlements
        case EconomicTile.Terraforming:
            state.terraformQueue = terraformingQueue(state)
            state.terraformedWorlds = []
            return state.terraformQueue.length > 0
                ? MachineState.Terraforming
                : stateAfterTerraforming(state)
        default:
            return stateAfterEconomicPhase(state)
    }
}

export function stateAfterEconomicPhase(state: HydratedStellarHorizonsGameState): MachineState {
    return branchingState(firstPhase(state))
}

export function stateAfterGrowth(state: HydratedStellarHorizonsGameState): MachineState {
    return converters(state).length > 0
        ? MachineState.ConvertingSettlements
        : stateAfterEconomicPhase(state)
}

// Rulebook 4.7: after terraforming, one world of each set-aside class joins the pool.
function stateAfterTerraforming(state: HydratedStellarHorizonsGameState): MachineState {
    state.terraformedWorlds = []
    if (!isCampaign(state)) {
        return MachineState.EndOfTurn
    }
    refillWorldPool(state)
    return stateAfterEconomicPhase(state)
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

// Footfall terraforms at the end of even decades; the campaign on its economic tile.
function stateAfterLastPhase(state: HydratedStellarHorizonsGameState): MachineState {
    if (
        !state.scenarioDefinition().terraforming ||
        isCampaign(state) ||
        !isEvenDecade(state.year)
    ) {
        return MachineState.EndOfTurn
    }
    state.terraformQueue = terraformingQueue(state)
    return state.terraformQueue.length > 0 ? MachineState.Terraforming : MachineState.EndOfTurn
}

export function stateAfterTerraformer(state: HydratedStellarHorizonsGameState): MachineState {
    state.terraformQueue = state.terraformQueue.slice(1)
    return state.terraformQueue.length > 0
        ? MachineState.Terraforming
        : stateAfterTerraforming(state)
}
