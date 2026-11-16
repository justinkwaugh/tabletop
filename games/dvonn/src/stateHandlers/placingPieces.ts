import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { startMovingTurn } from './movingStacks.js'
import { firstMovingTurn, turnHolder } from './turnFlow.js'

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
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: HydratedPlacePiece,
        context: MachineContext<HydratedDvonnGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        if (gameState.board.isFull()) {
            const next = firstMovingTurn(gameState)
            assertExists(action.metadata, 'A placement records its piece')
            if (next.passedPlayerId !== undefined) {
                action.metadata.passedPlayerId = next.passedPlayerId
            }
            return startMovingTurn(gameState, next)
        }
        gameState.turnManager.startNextTurn(gameState.actionCount)
        return MachineState.PlacingPieces
    }
}
