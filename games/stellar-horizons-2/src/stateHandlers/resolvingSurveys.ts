import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedResolveSurvey, ResolveSurvey, isResolveSurvey } from '../actions/resolveSurvey.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { DemandResume } from '../model/pieces.js'
import { stateAfterDemandDraws } from './transitions.js'

export class ResolvingSurveysStateHandler implements MachineStateHandler<
    HydratedResolveSurvey,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedResolveSurvey {
        return isResolveSurvey(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ResolveSurvey)
    }

    onAction(
        _action: HydratedResolveSurvey,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        if (state.surveyChoice) {
            return MachineState.ChoosingSurveyWorld
        }
        return stateAfterDemandDraws(state, DemandResume.Surveys)
    }
}
