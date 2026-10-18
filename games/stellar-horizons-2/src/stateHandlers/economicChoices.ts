import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedChooseProduction, isChooseProduction } from '../actions/chooseProduction.js'
import { HydratedConvertSettlement, isConvertSettlement } from '../actions/convertSettlement.js'
import { HydratedDeclareInitiative, isDeclareInitiative } from '../actions/declareInitiative.js'
import { HydratedPassConversion, isPassConversion } from '../actions/passConversion.js'
import { HydratedSkipPhase, SkipPhase, isSkipPhase } from '../actions/skipPhase.js'
import { HydratedSpendInfluence, isSpendInfluence } from '../actions/spendInfluence.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { canSpendInfluence } from '../model/campaign.js'
import { basesAwaitingProduction, converters, maxInitiativeBid } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { branchPlayerId, branchingState, playState } from '../model/turnPlan.js'
import { stateAfterEconomicPhase } from './transitions.js'

// The campaign's simultaneous economic choices (rulebook 4.1 and 4.4), each a Barrier span's
// Branch. A Player with nothing to choose skips it; one who has chosen everything is done.
abstract class EconomicChoiceHandler<Action extends HydratedAction> implements MachineStateHandler<
    Action | HydratedSpendInfluence | HydratedSkipPhase,
    HydratedStellarHorizonsGameState
> {
    protected abstract readonly phase: TurnPhase
    protected abstract readonly choice: ActionType

    protected abstract isChoice(action: HydratedAction): action is Action

    protected abstract hasChoice(state: HydratedStellarHorizonsGameState, playerId: string): boolean

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is Action | HydratedSpendInfluence | HydratedSkipPhase {
        return this.isChoice(action) || isSpendInfluence(action) || isSkipPhase(action)
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
            this.choice,
            ...(canSpendInfluence(state, playerId) ? [ActionType.SpendInfluence] : [])
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const playerId = branchPlayerId(state)
        if (!this.hasChoice(state, playerId)) {
            context.addSystemAction(SkipPhase, { playerId })
        }
    }

    onAction(
        action: Action | HydratedSpendInfluence | HydratedSkipPhase,
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
        return (
            state.getPlayerState(playerId).initiativeBid === undefined &&
            maxInitiativeBid(state, playerId) > 0
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

type ConvertingAction = HydratedConvertSettlement | HydratedPassConversion | HydratedSpendInfluence

// The True Path's conversion after growth (faction ability 1), on the Main Line.
export class ConvertingSettlementsStateHandler implements MachineStateHandler<
    ConvertingAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is ConvertingAction {
        return isConvertSettlement(action) || isPassConversion(action) || isSpendInfluence(action)
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
            ...(canSpendInfluence(state, playerId) ? [ActionType.SpendInfluence] : [])
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = converters(context.gameState).slice(0, 1)
    }

    onAction(
        action: ConvertingAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return isSpendInfluence(action)
            ? MachineState.ConvertingSettlements
            : stateAfterEconomicPhase(context.gameState)
    }
}
