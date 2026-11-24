import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedKeepWrits, isKeepWrits } from '../actions/keepWrits.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { followUpSeat } from '../model/followUps.js'
import { turnSeatsPending } from '../model/turns.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-4.4.1 The drawer keeps; R-3.10.2 Shovels & Swords returns here for its own keep. */
export class KeepingWritsStateHandler implements MachineStateHandler<
    HydratedKeepWrits,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedKeepWrits {
        return isKeepWrits(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        return turnSeatsPending(state, playerId, state.flow.writDraw) ? [ActionType.KeepWrits] : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        assertExists(state.flow.writDraw, 'R-4.4.1 Writs have been drawn')
        state.activePlayerIds = [followUpSeat(state)]
    }

    onAction(
        _action: HydratedKeepWrits,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return stateAfterCardStep(context)
    }
}
