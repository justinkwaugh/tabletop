import { EconomicTile } from '../components/economicTiles.js'
import { isEvenDecade } from '../components/scenarios.js'
import { MachineState } from '../definition/states.js'
import { anyAnomalyAttempts } from '../model/anomalies.js'
import { isCampaign } from '../model/campaign.js'
import { converters } from '../model/economy.js'
import { anyEventAttempts } from '../model/events.js'
import { pendingSyndicateTakes } from '../model/operations.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { playersWithEarnedMarkers } from '../model/settlement.js'
import { discardUnplaceableRewards } from '../model/settlementRewards.js'
import { destroyUnplaceableRewardGoods } from '../model/trade.js'
import { anyPendingSurveys } from '../model/surveys.js'
import { nextShipTerraformer, refillWorldPool, terraformingQueue } from '../model/terraforming.js'
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
        case TurnPhase.TradeGoods:
            return stateAfterEconomicPhase(state)
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
        case EconomicTile.DrawEvent:
            return MachineState.DrawingEvent
        case EconomicTile.DrawTradeGoods:
            return MachineState.DrawingTradeGoods
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

// After an event is drawn: its challenge is placed, then Homesteaders' bases are chosen.
export function stateAfterEventDraw(state: HydratedStellarHorizonsGameState): MachineState {
    if (state.eventPlacement) {
        return MachineState.PlacingEvent
    }
    return state.homesteaders.length > 0
        ? MachineState.PlacingHomesteaders
        : stateAfterEconomicPhase(state)
}

// Each Player assigns the goods they drew in a Barrier span.
export function stateAfterGoodsDraw(state: HydratedStellarHorizonsGameState): MachineState {
    return state.players.some((player) => player.drawnGoods.length > 0)
        ? branchingState(TurnPhase.TradeGoods)
        : stateAfterEconomicPhase(state)
}

export function stateAfterEconomicPhase(state: HydratedStellarHorizonsGameState): MachineState {
    return stateForPhase(state, firstPhase(state))
}

// The campaign plays the cargo and trade phase on the Main Line, in initiative order.
export function stateForPhase(
    state: HydratedStellarHorizonsGameState,
    phase: TurnPhase
): MachineState {
    if (phase === TurnPhase.Cargo && isCampaign(state)) {
        state.traders = state.initiativeOrder()
        return MachineState.Trading
    }
    return branchingState(phase)
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
    return next === undefined ? stateAfterLastPhase(state) : stateForPhase(state, next)
}

export function stateAfterExploring(state: HydratedStellarHorizonsGameState): MachineState {
    return playersWithEarnedMarkers(state).length > 0
        ? MachineState.SettlingExplorations
        : stateAfterSettlement(state)
}

export function stateAfterSettlement(state: HydratedStellarHorizonsGameState): MachineState {
    return pendingSyndicateTakes(state).length > 0
        ? MachineState.SettlingSyndicateTakes
        : stateAfterSyndicateTakes(state)
}

export function stateAfterSyndicateTakes(state: HydratedStellarHorizonsGameState): MachineState {
    return anyAnomalyAttempts(state) ? MachineState.ResolvingAnomalies : stateAfterAnomalies(state)
}

// After each anomaly attempt: its settlement reward is placed, a base it founds draws its
// demand marker, its goods are placed, then the next attempt resolves.
export function stateAfterAnomaly(state: HydratedStellarHorizonsGameState): MachineState {
    if (state.demandDraws.length > 0) {
        return MachineState.ChoosingDemand
    }
    discardUnplaceableRewards(state)
    if (state.settlementRewards.length > 0) {
        return MachineState.PlacingRewardSettlements
    }
    destroyUnplaceableRewardGoods(state)
    if (state.goodsRewards.length > 0) {
        return MachineState.PlacingRewardGoods
    }
    return anyAnomalyAttempts(state) ? MachineState.ResolvingAnomalies : stateAfterAnomalies(state)
}

export function stateAfterAnomalies(state: HydratedStellarHorizonsGameState): MachineState {
    return anyEventAttempts(state) ? MachineState.ResolvingEvents : stateAfterEvents(state)
}

export function stateAfterEvents(state: HydratedStellarHorizonsGameState): MachineState {
    return anyPendingSurveys(state) ? MachineState.ResolvingSurveys : stateAfterSurveys(state)
}

export function stateAfterSurveys(state: HydratedStellarHorizonsGameState): MachineState {
    return stateAfterShipTerraform(state)
}

// Mining ships' terraforms resolve last, after the surveys, one at a time in initiative order.
export function stateAfterShipTerraform(state: HydratedStellarHorizonsGameState): MachineState {
    if (nextShipTerraformer(state) !== undefined) {
        return MachineState.ResolvingShipTerraforms
    }
    state.terraformedWorlds = []
    return stateOfNextPhase(state, TurnPhase.Exploration)
}

// A replacement chosen during the economic phase's terraforming continues its queue; one chosen
// for a mining ship continues the ships' terraforms.
export function stateAfterTerraformChoice(state: HydratedStellarHorizonsGameState): MachineState {
    return state.terraformQueue.length > 0
        ? stateAfterTerraformer(state)
        : stateAfterShipTerraform(state)
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
