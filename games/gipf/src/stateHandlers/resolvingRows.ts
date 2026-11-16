import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedFinishRemoving, isFinishRemoving } from '../actions/finishRemoving.js'
import { HydratedGipfGameState } from '../model/gameState.js'
import { continueResolving, finishResolver } from './turnFlow.js'

type ResolvingRowsAction = HydratedRemoveRow | HydratedFinishRemoving

export class ResolvingRowsStateHandler implements MachineStateHandler<
    ResolvingRowsAction,
    HydratedGipfGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedGipfGameState>
    ): action is ResolvingRowsAction {
        return isRemoveRow(action) || isFinishRemoving(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedGipfGameState>
    ): ActionType[] {
        const { board } = context.gameState
        const mustRemove = board.rowsOf(playerId).some((row) => board.isMandatory(row))
        return mustRemove
            ? [ActionType.RemoveRow]
            : [ActionType.RemoveRow, ActionType.FinishRemoving]
    }

    enter(context: MachineContext<HydratedGipfGameState>) {
        const { gameState } = context
        gameState.activePlayerIds = gameState.resolvingPlayerIds.slice(0, 1)
    }

    onAction(
        action: ResolvingRowsAction,
        context: MachineContext<HydratedGipfGameState>
    ): MachineState {
        const { gameState } = context
        if (isFinishRemoving(action)) {
            return finishResolver(gameState)
        }
        return continueResolving(gameState)
    }
}
