import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedAssignGoods, isAssignGoods } from '../actions/assignGoods.js'
import { HydratedChooseProduction, isChooseProduction } from '../actions/chooseProduction.js'
import { HydratedChooseGrowthBase, isChooseGrowthBase } from '../actions/chooseGrowthBase.js'
import { HydratedConvertSettlement, isConvertSettlement } from '../actions/convertSettlement.js'
import { HydratedDeclareInitiative, isDeclareInitiative } from '../actions/declareInitiative.js'
import { HydratedPassConversion, isPassConversion } from '../actions/passConversion.js'
import { HydratedSkipPhase, SkipPhase, isSkipPhase } from '../actions/skipPhase.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { basesAwaitingProduction, maxInitiativeBid } from '../model/economy.js'
import { choosesEscalationKept } from '../model/escalation.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { type SpanPhase, TurnPhase } from '../model/turn.js'
import { branchPlayerId, branchingState, playState } from '../model/turnPlan.js'
import { type ConversionAction, conversionActions, isConversion } from './conversions.js'
import { stateAfterEconomicPhase, stateAfterGrowthChoices } from './transitions.js'

// The campaign's simultaneous economic choices (rulebook 4.1, 4.4 and 4.5), each a Barrier span's
// Branch. A Player with nothing to choose skips it; one who has chosen everything is done.
abstract class EconomicChoiceHandler<Action extends HydratedAction> implements MachineStateHandler<
    Action | ConversionAction | HydratedSkipPhase,
    HydratedStellarHorizonsGameState
> {
    protected abstract readonly phase: SpanPhase
    protected abstract readonly choice: ActionType

    protected abstract isChoice(action: HydratedAction): action is Action

    protected abstract hasChoice(state: HydratedStellarHorizonsGameState, playerId: string): boolean

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is Action | ConversionAction | HydratedSkipPhase {
        return this.isChoice(action) || isConversion(action) || isSkipPhase(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [this.choice, ...conversionActions(state, playerId)]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const playerId = branchPlayerId(state)
        if (!this.hasChoice(state, playerId)) {
            context.addSystemAction(SkipPhase, { playerId })
        }
    }

    onAction(
        action: Action | ConversionAction | HydratedSkipPhase,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        if (isSkipPhase(action) || !this.hasChoice(state, branchPlayerId(state))) {
            return branchingState(this.phase)
        }
        return playState(this.phase)
    }
}

export class DecidingInitiativeStateHandler extends EconomicChoiceHandler<HydratedDeclareInitiative> {
    protected readonly phase = TurnPhase.Initiative
    protected readonly choice = ActionType.DeclareInitiative

    protected isChoice(action: HydratedAction): action is HydratedDeclareInitiative {
        return isDeclareInitiative(action)
    }

    protected hasChoice(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        return (
            player.initiativeBid === undefined &&
            (maxInitiativeBid(state, playerId) > 0 || choosesEscalationKept(player))
        )
    }
}

export class ChoosingProductionStateHandler extends EconomicChoiceHandler<HydratedChooseProduction> {
    protected readonly phase = TurnPhase.BaseProduction
    protected readonly choice = ActionType.ChooseProduction

    protected isChoice(action: HydratedAction): action is HydratedChooseProduction {
        return isChooseProduction(action)
    }

    protected hasChoice(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return basesAwaitingProduction(state, playerId).length > 0
    }
}

export class AssigningGoodsStateHandler extends EconomicChoiceHandler<HydratedAssignGoods> {
    protected readonly phase = TurnPhase.TradeGoods
    protected readonly choice = ActionType.AssignGoods

    protected isChoice(action: HydratedAction): action is HydratedAssignGoods {
        return isAssignGoods(action)
    }

    protected hasChoice(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return state.getPlayerState(playerId).drawnGoods.length > 0
    }
}

type GrowthChoiceAction = HydratedChooseGrowthBase | ConversionAction

// Prolific Breeders' base after growth, on the Main Line in initiative order (rulebook 4.6).
export class ChoosingGrowthBaseStateHandler implements MachineStateHandler<
    GrowthChoiceAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is GrowthChoiceAction {
        return isChooseGrowthBase(action) || isConversion(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [ActionType.ChooseGrowthBase, ...conversionActions(state, playerId)]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = context.gameState.growthChoosers.slice(0, 1)
    }

    onAction(
        action: GrowthChoiceAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        if (isConversion(action) || state.growthChoosers.length > 0) {
            return MachineState.ChoosingGrowthBase
        }
        return stateAfterGrowthChoices(state)
    }
}

type ConvertingAction = HydratedConvertSettlement | HydratedPassConversion | ConversionAction

// The conversion rolls after growth (the True Path's ability, Cultural Dominance), on the Main
// Line, one roll at a time in initiative order.
export class ConvertingSettlementsStateHandler implements MachineStateHandler<
    ConvertingAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is ConvertingAction {
        return isConvertSettlement(action) || isPassConversion(action) || isConversion(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [
            ActionType.ConvertSettlement,
            ActionType.PassConversion,
            ...conversionActions(state, playerId)
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const next = context.gameState.conversions.at(0)
        context.gameState.activePlayerIds = next ? [next.playerId] : []
    }

    onAction(
        action: ConvertingAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return isConversion(action) || context.gameState.conversions.length > 0
            ? MachineState.ConvertingSettlements
            : stateAfterEconomicPhase(context.gameState)
    }
}
