import { assertExists } from '@tabletop/common'
import { EconomicTile } from '../components/economicTiles.js'
import { isEvenDecade } from '../components/scenarios.js'
import { MachineState } from '../definition/states.js'
import { anyAnomalyAttempts } from '../model/anomalies.js'
import { endBlockades, queueBlockades } from '../model/blockades.js'
import { defenderCanAnswer, dropIdleAttackers, queueAttackers } from '../model/attacks.js'
import { clearFoughtCombat, isBattle, isCombatOver } from '../model/combat.js'
import { CombatKind } from '../model/pieces.js'
import { isCampaign } from '../model/campaign.js'
import { queueConversions } from '../model/economy.js'
import { anyEventAttempts } from '../model/events.js'
import { pendingSyndicateTakes } from '../model/operations.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { playersWithEarnedMarkers } from '../model/settlement.js'
import { discardUnplaceableRewards } from '../model/settlementRewards.js'
import { destroyUnplaceableRewardGoods } from '../model/trade.js'
import { anyPendingSurveys } from '../model/surveys.js'
import { nextShipTerraformer, refillWorldPool, terraformingQueue } from '../model/terraforming.js'
import { nextCardDrawer } from '../model/cards.js'
import { BlockadeStep, CardsResume, DemandResume, DirectiveResume } from '../model/pieces.js'
import { anyDirectiveChoice, anyDirectiveDeal, usesDirectives } from '../model/directives.js'
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
        case TurnPhase.Development:
            return stateForCardDraws(state, CardsResume.AfterDevelopment)
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
            return stateForBlockades(state, BlockadeStep.Production)
        case EconomicTile.DrawEvent:
            return MachineState.DrawingEvent
        case EconomicTile.DrawTradeGoods:
            return MachineState.DrawingTradeGoods
        case EconomicTile.SettlementGrowth:
            return stateForBlockades(state, BlockadeStep.Growth)
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

// Rulebook 4.4 and 4.6: blockades are declared before base production and before growth.
function stateForBlockades(
    state: HydratedStellarHorizonsGameState,
    step: BlockadeStep
): MachineState {
    queueBlockades(state, step)
    return state.remainingBlockaders.length > 0
        ? MachineState.Blockading
        : stateAfterBlockades(state)
}

export function stateAfterBlockades(state: HydratedStellarHorizonsGameState): MachineState {
    return state.blockadeStep === BlockadeStep.Growth
        ? MachineState.GrowingSettlements
        : branchingState(TurnPhase.BaseProduction)
}

// The economic phase's blockades last for its step; the transfer markers drop after it.
export function stateAfterEconomicPhase(state: HydratedStellarHorizonsGameState): MachineState {
    endBlockades(state)
    return isCampaign(state)
        ? MachineState.ReducingTransferMarkers
        : startPhase(state, firstPhase(state))
}

const COMBAT_IN_VIEW: readonly TurnPhase[] = [TurnPhase.Cargo, TurnPhase.Movement]

// The campaign plays the combat phase and the cargo and trade phase on the Main Line, in
// initiative order. Nobody with an attack to make, the truce among them, skips combat. The last
// combat fought stays in view through the cargo and movement phases, which may be skipped.
export function startPhase(
    state: HydratedStellarHorizonsGameState,
    phase: TurnPhase
): MachineState {
    if (!COMBAT_IN_VIEW.includes(phase)) {
        clearFoughtCombat(state)
    }
    if (phase === TurnPhase.Combat) {
        queueAttackers(state)
        return state.remainingAttackers.length > 0
            ? MachineState.Attacking
            : stateOfNextPhase(state, phase)
    }
    if (phase === TurnPhase.Cargo && isCampaign(state)) {
        state.remainingTraders = state.initiativeOrder()
        return MachineState.Trading
    }
    return branchingState(phase)
}

// A combat goes from the defender's answer to the hits, the raid's result and the escalation
// markers; between combats the attacker plays on until they have nothing left to attack.
export function stateAfterCombatStep(state: HydratedStellarHorizonsGameState): MachineState {
    const combat = state.combat
    if (combat) {
        if (isCombatOver(combat)) {
            return MachineState.EndingCombat
        }
        if (isBattle(combat.kind) && !combat.rolls && defenderCanAnswer(state, combat)) {
            return MachineState.Defending
        }
        return combat.kind === CombatKind.Raid
            ? MachineState.ResolvingRaid
            : MachineState.AssigningHits
    }
    dropIdleAttackers(state)
    return state.remainingAttackers.length > 0
        ? MachineState.Attacking
        : stateOfNextPhase(state, TurnPhase.Combat)
}

// After growth: Prolific Breeders' bases are chosen, then the conversion rolls are taken.
export function stateAfterGrowth(state: HydratedStellarHorizonsGameState): MachineState {
    return state.growthChoosers.length > 0
        ? MachineState.ChoosingGrowthBase
        : stateAfterGrowthChoices(state)
}

export function stateAfterGrowthChoices(state: HydratedStellarHorizonsGameState): MachineState {
    queueConversions(state)
    return state.conversions.length > 0
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
    return next === undefined ? stateAfterLastPhase(state) : startPhase(state, next)
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

// Rulebook 1.9: a system's demand marker comes immediately, so a draw interrupts play, which
// resumes once the marker is kept. Where it resumes is worked out only then.
export function stateAfterDemandDraws(
    state: HydratedStellarHorizonsGameState,
    resume: DemandResume
): MachineState {
    if (state.demandDraws.length > 0) {
        state.resumeAfterDemand = resume
        return MachineState.ChoosingDemand
    }
    return resumedState(state, resume)
}

export function resumedState(
    state: HydratedStellarHorizonsGameState,
    resume: DemandResume
): MachineState {
    switch (resume) {
        case DemandResume.Trading:
            return MachineState.Trading
        case DemandResume.Surveys:
            return anyPendingSurveys(state)
                ? MachineState.ResolvingSurveys
                : stateAfterSurveys(state)
        case DemandResume.Anomaly:
            return stateAfterAnomaly(state)
    }
}

// Cards owed to hands are drawn before play goes on (rulebook 1.20).
export function stateForCardDraws(
    state: HydratedStellarHorizonsGameState,
    resume: CardsResume
): MachineState {
    if (nextCardDrawer(state) !== undefined) {
        state.resumeAfterCards = resume
        return MachineState.DrawingCards
    }
    return resumedAfterCards(state, resume)
}

export function resumedAfterCards(
    state: HydratedStellarHorizonsGameState,
    resume: CardsResume
): MachineState {
    switch (resume) {
        case CardsResume.Setup:
            return stateForDirectives(state, DirectiveResume.Setup)
        case CardsResume.Anomaly:
            return stateAfterAnomaly(state)
        case CardsResume.AfterDevelopment:
            return stateOfNextPhase(state, TurnPhase.Development)
    }
}

// Rulebook 5.1: directives are dealt at the start, at the start of each turn to Players holding
// none, and after a span to Players who redrew in it; those drawn are then chosen. Play resumes
// where it was once they are.
export function stateForDirectives(
    state: HydratedStellarHorizonsGameState,
    resume: DirectiveResume,
    phase?: TurnPhase
): MachineState {
    if (!usesDirectives(state) || (!anyDirectiveDeal(state) && !anyDirectiveChoice(state))) {
        return resumedAfterDirectives(state, resume, phase)
    }
    state.directiveResume = { resume, ...(phase !== undefined ? { phase } : {}) }
    return anyDirectiveDeal(state)
        ? MachineState.DealingDirectives
        : branchingState(TurnPhase.Directives)
}

export function stateAfterDirectives(state: HydratedStellarHorizonsGameState): MachineState {
    const point = state.directiveResume
    assertExists(point, 'Choosing directives needs a step to resume')
    state.directiveResume = undefined
    return resumedAfterDirectives(state, point.resume, point.phase)
}

function resumedAfterDirectives(
    state: HydratedStellarHorizonsGameState,
    resume: DirectiveResume,
    phase: TurnPhase | undefined
): MachineState {
    switch (resume) {
        case DirectiveResume.Setup:
            return startPhase(state, firstPhase(state))
        case DirectiveResume.TurnStart:
            return MachineState.EconomicPhase
        case DirectiveResume.AfterPhase:
            assertExists(phase, 'Resuming after a span needs its phase')
            return stateAfterPhase(state, phase)
    }
}

// A span's Players may have redrawn directives in their Branches; those are dealt before play
// goes on.
export function stateAfterSpan(
    state: HydratedStellarHorizonsGameState,
    phase: TurnPhase
): MachineState {
    return phase === TurnPhase.Directives
        ? stateAfterDirectives(state)
        : stateForDirectives(state, DirectiveResume.AfterPhase, phase)
}

// After each anomaly attempt: a card earned from the hand is replaced, its settlement reward is
// placed, its goods are placed, then the next attempt resolves.
export function stateAfterAnomaly(state: HydratedStellarHorizonsGameState): MachineState {
    if (nextCardDrawer(state) !== undefined) {
        return stateForCardDraws(state, CardsResume.Anomaly)
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
