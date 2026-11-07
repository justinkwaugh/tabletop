import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedAnswerStarve, isAnswerStarve } from '../actions/answerStarve.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-3.14-H1 The marker's owner alone answers; then the actor's card step ends. */
export class AwaitingImmunityStateHandler implements MachineStateHandler<
    HydratedAnswerStarve,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedAnswerStarve {
        return isAnswerStarve(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return context.gameState.flow.starve?.targetPlayerId === playerId
            ? [ActionType.AnswerStarve]
            : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        assertExists(state.flow.starve, 'R-3.14-H1 A Starve is waiting')
        state.activePlayerIds = [state.flow.starve.targetPlayerId]
    }

    onAction(
        _action: HydratedAnswerStarve,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return stateAfterCardStep(context)
    }
}
