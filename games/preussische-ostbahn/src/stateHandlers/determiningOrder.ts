import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    DeterminePlayerOrder,
    HydratedDeterminePlayerOrder,
    isDeterminePlayerOrder
} from '../actions/determinePlayerOrder.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'

export class DeterminingOrderStateHandler implements MachineStateHandler<
    HydratedDeterminePlayerOrder,
    HydratedOstbahnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOstbahnGameState>
    ): action is HydratedDeterminePlayerOrder {
        return isDeterminePlayerOrder(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedOstbahnGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedOstbahnGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(DeterminePlayerOrder, {})
    }

    onAction(
        action: HydratedDeterminePlayerOrder,
        _context: MachineContext<HydratedOstbahnGameState>
    ): MachineState {
        return action.metadata?.endReason ? MachineState.EndOfGame : MachineState.ChoosingAction
    }
}
