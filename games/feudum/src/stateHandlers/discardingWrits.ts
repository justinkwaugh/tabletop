import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { isDiscardWrit, type HydratedDiscardWrit } from '../actions/discardWrit.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { writsOverLimit } from '../model/atWill.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-4.4.4 A discard (R-4.4-H5, sent at any time) or what the turn player may do at will. */
type WritLimitAction = HydratedDiscardWrit | AtWillAction

/**
 * R-4.4.4, R-4.4-H6 A turn player over the writ limit acts at will until back within it; R-4.4-H6
 * means it always holds an unsealed writ to discard. Then the turn goes on.
 */
export class DiscardingWritsStateHandler implements MachineStateHandler<
    WritLimitAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is WritLimitAction {
        return isDiscardWrit(action) || isAtWillAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return atWillOffers(context.gameState, playerId)
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const { turn } = context.gameState.flow
        assertExists(turn, 'R-4.4.4 The writ limit belongs to a turn')
        context.gameState.activePlayerIds = [turn.playerId]
    }

    onAction(
        action: WritLimitAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        const state = context.gameState
        return writsOverLimit(state, action.playerId)
            ? MachineState.DiscardingWrits
            : stateAfterCardStep(context)
    }
}
