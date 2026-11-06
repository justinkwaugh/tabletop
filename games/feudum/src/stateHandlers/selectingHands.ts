import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedFinaliseHand, isFinaliseHand } from '../actions/finaliseHand.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-3.1-H1 Seats draft in their own clients; only the first not finalised is asked. */
export class SelectingHandsStateHandler implements MachineStateHandler<
    HydratedFinaliseHand,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedFinaliseHand {
        return isFinaliseHand(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return context.gameState.flow.selection?.playerId === playerId
            ? [ActionType.FinaliseHand]
            : []
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
        _action: HydratedFinaliseHand,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return MachineState.SelectingHands
    }
}
