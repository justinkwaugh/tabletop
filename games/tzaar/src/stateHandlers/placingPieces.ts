import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { activateCurrentPlayer, beginPlay } from './turnFlow.js'

export class PlacingPiecesStateHandler implements MachineStateHandler<
    HydratedPlacePiece,
    HydratedTzaarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedTzaarGameState>
    ): action is HydratedPlacePiece {
        return isPlacePiece(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedTzaarGameState>
    ): ActionType[] {
        return [ActionType.PlacePiece]
    }

    enter(context: MachineContext<HydratedTzaarGameState>) {
        activateCurrentPlayer(context.gameState)
    }

    onAction(
        _action: HydratedPlacePiece,
        context: MachineContext<HydratedTzaarGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        if (gameState.board.isFull()) {
            return beginPlay(gameState)
        }
        gameState.turnManager.startNextTurn(gameState.actionCount)
        return MachineState.PlacingPieces
    }
}
