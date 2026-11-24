import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { activateCurrentPlayer, beginPlay } from './turnFlow.js'
import { TzaarVersion, versionFromConfig } from '../definition/config.js'

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
        action: HydratedPlacePiece,
        context: MachineContext<HydratedTzaarGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        const setsBoard = versionFromConfig(context.gameConfig) === TzaarVersion.ISetYouChoose
        if (!gameState.board.isFull()) {
            if (setsBoard) {
                gameState.turnManager.startTurn(gameState.firstPlayerId(), gameState.actionCount)
            } else {
                gameState.turnManager.startNextTurn(gameState.actionCount)
            }
            return MachineState.PlacingPieces
        }
        if (setsBoard) {
            const chooserId = gameState.opponentOf(gameState.firstPlayerId())
            gameState.turnManager.startTurn(chooserId, gameState.actionCount)
            return MachineState.ChoosingColor
        }
        assertExists(action.metadata, 'A processed placement records its metadata')
        return beginPlay(gameState, action.metadata.stuckPlayerId)
    }
}
