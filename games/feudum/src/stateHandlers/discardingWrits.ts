import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { isDiscardWrit, type HydratedDiscardWrit } from '../actions/discardWrit.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { seatOverLimit } from '../model/atWill.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-4.4.4 A discard (R-4.4-H5, sent at any time) or what the turn player may do at will. */
type WritLimitAction = HydratedDiscardWrit | AtWillAction

/**
 * R-4.4.4 A seat over the writ limit, on its turn or not, discards down before play goes on; the
 * turn player may also act at will (R-4.4-H1). No charter is sealed during play (R-4.4-H6), so the
 * seat always holds a writ to discard. Then the card goes on where it stopped.
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
        const state = context.gameState
        assertExists(state.flow.turn, 'R-4.4.4 The writ limit is reached in a turn')
        const playerId = seatOverLimit(state)
        assertExists(playerId, 'R-4.4.4 A seat is over the writ limit')
        state.activePlayerIds = [playerId]
    }

    onAction(
        _action: WritLimitAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return stateAfterCardStep(context)
    }
}
