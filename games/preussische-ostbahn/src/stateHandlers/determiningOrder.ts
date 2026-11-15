import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    DeterminePlayerOrder,
    HydratedDeterminePlayerOrder,
    isDeterminePlayerOrder
} from '../actions/determinePlayerOrder.js'
import { RoundEndKind, type HydratedOstbahnGameState } from '../model/gameState.js'

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
        playerId: string,
        context: MachineContext<HydratedOstbahnGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.DeterminePlayerOrder] : []
    }

    enter(context: MachineContext<HydratedOstbahnGameState>) {
        const state = context.gameState
        const roundEnd = state.roundEnd()
        if (roundEnd.kind === RoundEndKind.GameOver) {
            state.activePlayerIds = []
            context.addSystemAction(DeterminePlayerOrder, {})
            return
        }
        state.activePlayerIds = [roundEnd.drawerId]
    }

    onAction(
        action: HydratedDeterminePlayerOrder,
        _context: MachineContext<HydratedOstbahnGameState>
    ): MachineState {
        return action.metadata?.endReason ? MachineState.EndOfGame : MachineState.ChoosingAction
    }
}
