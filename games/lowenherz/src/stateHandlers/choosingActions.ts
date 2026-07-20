import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedChooseAction } from '../actions/chooseAction.js'
import {
    buildDecisionPlan,
    currentDecisionPlayer,
    isRoundDecided,
    rotateToStart
} from '../util/decisionPlan.js'

type ChoosingActionsAction = HydratedChooseAction

function planFor(state: HydratedLowenherzGameState): string[] {
    return buildDecisionPlan(rotateToStart(state.turnOrder, state.firstPlayerId))
}

export class ChoosingActionsStateHandler
    implements MachineStateHandler<ChoosingActionsAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is ChoosingActionsAction {
        return action instanceof HydratedChooseAction && action.isValidChooseAction(context.gameState)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        return HydratedChooseAction.canChooseAction(context.gameState, playerId)
            ? [ActionType.ChooseAction]
            : []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        const nextPlayerId = currentDecisionPlayer(planFor(gameState), gameState.decisions.length)
        // nextPlayerId should always be defined here - if the round were fully decided,
        // onAction would have already transitioned away from ChoosingActions before
        // this state's enter() runs again.
        gameState.activePlayerIds = nextPlayerId ? [nextPlayerId] : []
    }

    onAction(
        action: ChoosingActionsAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        const gameState = context.gameState
        return isRoundDecided(planFor(gameState), gameState.decisions.length)
            ? MachineState.ResolvingActions
            : MachineState.ChoosingActions
    }
}
