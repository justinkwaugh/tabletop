import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedYinshGameState } from '../model/gameState.js'

export class RemovingRowStateHandler implements MachineStateHandler<
    HydratedRemoveRow,
    HydratedYinshGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedYinshGameState>
    ): action is HydratedRemoveRow {
        return isRemoveRow(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedYinshGameState>
    ): ActionType[] {
        return [ActionType.RemoveRow]
    }

    enter(context: MachineContext<HydratedYinshGameState>) {
        const { gameState } = context
        gameState.activePlayerIds = gameState.resolvingPlayerIds.slice(0, 1)
    }

    onAction(
        _action: HydratedRemoveRow,
        _context: MachineContext<HydratedYinshGameState>
    ): MachineState {
        return MachineState.RemovingRing
    }
}
