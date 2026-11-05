import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPushPiece, isPushPiece } from '../actions/pushPiece.js'
import { HydratedMovePotential, isMovePotential } from '../actions/movePotential.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'
import { afterMove, continueResolving } from './turnFlow.js'

type TakingTurnAction = HydratedPushPiece | HydratedMovePotential | HydratedRemoveRow

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedGipfPotentialsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedGipfPotentialsGameState>
    ): action is TakingTurnAction {
        return isPushPiece(action) || isMovePotential(action) || isRemoveRow(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedGipfPotentialsGameState>
    ): ActionType[] {
        const { gameState } = context
        const { board } = gameState
        const optionalRows = board.rowsOf(playerId).filter((row) => !board.isMandatory(row))
        return [
            ...(gameState.pushableKinds(playerId).length > 0 ? [ActionType.PushPiece] : []),
            ...(gameState.potentialMoves(playerId).length > 0 ? [ActionType.MovePotential] : []),
            ...(optionalRows.length > 0 ? [ActionType.RemoveRow] : [])
        ]
    }

    enter(context: MachineContext<HydratedGipfPotentialsGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
        gameState.resolvingPlayerIds = []
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedGipfPotentialsGameState>
    ): MachineState {
        const { gameState } = context
        if (isRemoveRow(action)) {
            return continueResolving(gameState)
        }
        gameState.movedThisTurn = true
        const tamskOwnerId = isPushPiece(action) ? action.metadata?.tamskOwnerId : undefined
        return afterMove(gameState, action.playerId, tamskOwnerId)
    }
}
