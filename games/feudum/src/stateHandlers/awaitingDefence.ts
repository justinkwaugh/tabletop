import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedAnswerAttack, isAnswerAttack } from '../actions/answerAttack.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-3.14-H1 The defender alone answers; flip or "no", the attacker commits next. */
export class AwaitingDefenceStateHandler implements MachineStateHandler<
    HydratedAnswerAttack,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedAnswerAttack {
        return isAnswerAttack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return context.gameState.flow.combat?.defenderId === playerId
            ? [ActionType.AnswerAttack]
            : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        assertExists(state.flow.combat, 'R-3.14-H1 An attack is waiting')
        state.activePlayerIds = [state.flow.combat.defenderId]
    }

    onAction(
        _action: HydratedAnswerAttack,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return context.gameState.flow.combat
            ? MachineState.CommittingAttack
            : stateAfterCardStep(context)
    }
}
