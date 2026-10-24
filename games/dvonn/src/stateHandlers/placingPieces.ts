import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { beginMovingStacks } from './movingStacks.js'

export class PlacingPiecesStateHandler implements MachineStateHandler<
    HydratedPlacePiece,
    HydratedDvonnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedDvonnGameState>
    ): action is HydratedPlacePiece {
        return isPlacePiece(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDvonnGameState>
    ): ActionType[] {
        return [ActionType.PlacePiece]
    }

    enter(context: MachineContext<HydratedDvonnGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
    }

    onAction(
        _action: HydratedPlacePiece,
        context: MachineContext<HydratedDvonnGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        if (gameState.board.isFull()) {
            return beginMovingStacks(gameState)
        }
        gameState.turnManager.startNextTurn(gameState.actionCount)
        return MachineState.PlacingPieces
    }
}
