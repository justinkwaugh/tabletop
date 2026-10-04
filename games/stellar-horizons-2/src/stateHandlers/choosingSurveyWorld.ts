import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { HydratedChooseSurveyWorld, isChooseSurveyWorld } from '../actions/chooseSurveyWorld.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterSurveys } from './transitions.js'

export class ChoosingSurveyWorldStateHandler implements MachineStateHandler<
    HydratedChooseSurveyWorld,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedChooseSurveyWorld {
        return isChooseSurveyWorld(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.ChooseSurveyWorld] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const choice = context.gameState.surveyChoice
        assertExists(choice, 'Choosing a survey world requires a pending choice')
        context.gameState.activePlayerIds = [choice.playerId]
    }

    onAction(
        _action: HydratedChooseSurveyWorld,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        return state.pendingSurveys.length > 0
            ? MachineState.ResolvingSurveys
            : stateAfterSurveys(state)
    }
}
