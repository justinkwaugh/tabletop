import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPushPiece, isPushPiece } from '../actions/pushPiece.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedGipfGameState } from '../model/gameState.js'
import { startResolving } from './turnFlow.js'

type TakingTurnAction = HydratedPushPiece | HydratedRemoveRow

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedGipfGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedGipfGameState>
    ): action is TakingTurnAction {
        return isPushPiece(action) || isRemoveRow(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedGipfGameState>
    ): ActionType[] {
        const { board } = context.gameState
        const optionalRows = board.rowsOf(playerId).filter((row) => !board.isMandatory(row))
        return optionalRows.length > 0
            ? [ActionType.PushPiece, ActionType.RemoveRow]
            : [ActionType.PushPiece]
    }

    enter(context: MachineContext<HydratedGipfGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
        gameState.resolvingPlayerIds = []
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedGipfGameState>
    ): MachineState {
        if (isPushPiece(action)) {
            return startResolving(context.gameState, action.playerId)
        }
        return MachineState.TakingTurn
    }
}
