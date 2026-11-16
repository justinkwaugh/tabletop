import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedMatrxGameState } from '../model/gameState.js'
import { continueResolving } from './turnFlow.js'

export class ResolvingRowsStateHandler implements MachineStateHandler<
    HydratedRemoveRow,
    HydratedMatrxGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedMatrxGameState>
    ): action is HydratedRemoveRow {
        return isRemoveRow(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedMatrxGameState>
    ): ActionType[] {
        return [ActionType.RemoveRow]
    }

    enter(context: MachineContext<HydratedMatrxGameState>) {
        const { gameState } = context
        gameState.activePlayerIds = gameState.resolvingPlayerIds.slice(0, 1)
    }

    onAction(
        _action: HydratedRemoveRow,
        context: MachineContext<HydratedMatrxGameState>
    ): MachineState {
        return continueResolving(context.gameState)
    }
}
