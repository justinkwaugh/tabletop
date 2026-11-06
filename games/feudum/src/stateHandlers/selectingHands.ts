import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedFinaliseHand, isFinaliseHand } from '../actions/finaliseHand.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'

/** R-3.1-H1, R-4.4-H1 What the seat asked may send here. */
type SelectingHandsAction = HydratedFinaliseHand | AtWillAction

/** R-3.1-H1 Seats draft in their own clients; only the first not finalised is asked. */
export class SelectingHandsStateHandler implements MachineStateHandler<
    SelectingHandsAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is SelectingHandsAction {
        return isFinaliseHand(action) || isAtWillAction(action)
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

    /** R-3.1-H1 The first seat in turn order not finalised; after the last, nobody yet. */
    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        const finalised = state.flow.selection?.finalised ?? []
        const next = state.turnManager.turnOrder.find((id) => !finalised.includes(id))
        state.flow.selection = next ? { playerId: next, finalised } : undefined
        state.activePlayerIds = next ? [next] : []
    }

    onAction(
        _action: SelectingHandsAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return MachineState.SelectingHands
    }
}
