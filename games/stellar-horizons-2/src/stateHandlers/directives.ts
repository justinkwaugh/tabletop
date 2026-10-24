import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedChooseDirective, isChooseDirective } from '../actions/chooseDirective.js'
import {
    DealDirectives,
    HydratedDealDirectives,
    isDealDirectives
} from '../actions/dealDirectives.js'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { anyDirectiveChoice, choosesDirective } from '../model/directives.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { branchingState } from '../model/turnPlan.js'
import { EconomicChoiceHandler } from './economicChoices.js'
import { stateAfterDirectives } from './transitions.js'

// Rulebook 5.1: directives are dealt from the shared pool on the Main Line; those drawn are then
// chosen in a Barrier span.
export class DealingDirectivesStateHandler implements MachineStateHandler<
    HydratedDealDirectives,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedDealDirectives {
        return isDealDirectives(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(DealDirectives)
    }

    onAction(
        _action: HydratedDealDirectives,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        return anyDirectiveChoice(state)
            ? branchingState(TurnPhase.Directives)
            : stateAfterDirectives(state)
    }
}

export class ChoosingDirectiveStateHandler extends EconomicChoiceHandler<HydratedChooseDirective> {
    protected readonly phase = TurnPhase.Directives
    protected readonly choice = ActionType.ChooseDirective

    protected isChoice(action: HydratedAction): action is HydratedChooseDirective {
        return isChooseDirective(action)
    }

    protected hasChoice(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return choosesDirective(state.getPlayerState(playerId))
    }
}
