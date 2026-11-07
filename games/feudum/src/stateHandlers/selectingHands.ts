import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedFinaliseHand, isFinaliseHand } from '../actions/finaliseHand.js'
import { HydratedStartRound, isStartRound } from '../actions/startRound.js'
import { ActionType } from '../definition/actions.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'

/** R-2.2, R-3.1-H1, R-4.4-H1 `StartRound` opens the state; the rest are the seat asked's. */
type SelectingHandsAction = HydratedStartRound | HydratedFinaliseHand | AtWillAction

/** R-3.1-H1 Seats draft in their own clients; only the first not finalised is asked. */
export class SelectingHandsStateHandler implements MachineStateHandler<
    SelectingHandsAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is SelectingHandsAction {
        return isStartRound(action) || isFinaliseHand(action) || isAtWillAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        if (state.flow.selection?.playerId !== playerId) {
            return []
        }
        return [ActionType.FinaliseHand, ...atWillOffers(state, playerId)]
    }

    /** R-3.1-H1 The first seat in turn order not finalised; nobody until `StartRound` has run. */
    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        const { selection } = state.flow
        if (!selection) {
            state.activePlayerIds = []
            return
        }
        const next = state.turnManager.turnOrder.find((id) => !selection.finalised.includes(id))
        assertExists(next, 'R-3.1-H1 A seat is still to finalise')
        selection.playerId = next
        state.activePlayerIds = [next]
    }

    /** R-3.1-H1, R-3.2 After the last finaliser, cards begin with no turn open: `PlayingCards` asks. */
    onAction(
        action: SelectingHandsAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        const state = context.gameState
        const { selection } = state.flow
        if (
            !isFinaliseHand(action) ||
            selection?.finalised.length !== state.turnManager.turnOrder.length
        ) {
            return MachineState.SelectingHands
        }
        state.flow.selection = undefined
        state.flow.turn = undefined
        beginPhase(state, PhaseName.Cards)
        return MachineState.PlayingCards
    }
}
