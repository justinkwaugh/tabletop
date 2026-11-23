import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedCommitAttack, isCommitAttack } from '../actions/commitAttack.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { followUpSeat } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-4.8.2 The attacker commits; the combat resolves; R-4.9-H1 any follow-up runs. */
export class CommittingAttackStateHandler implements MachineStateHandler<
    HydratedCommitAttack,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedCommitAttack {
        return isCommitAttack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        return state.flow.combat && followUpSeat(state) === playerId
            ? [ActionType.CommitAttack]
            : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        assertExists(state.flow.combat, 'R-4.8.2 An attack is waiting')
        state.activePlayerIds = [followUpSeat(state)]
    }

    onAction(
        _action: HydratedCommitAttack,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return stateAfterCardStep(context)
    }
}
