import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { LyngkSetup, setupFromConfig } from '../definition/config.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedLyngkGameState } from '../model/gameState.js'

function turnHolder(state: HydratedLyngkGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A piece is placed only during a turn')
    return turn.playerId
}

// The players set the board, taking turns or the first player alone, and the second player
// then moves first. A joker can go onto any piece, so the full board always has a move.
export class PlacingPiecesStateHandler implements MachineStateHandler<
    HydratedPlacePiece,
    HydratedLyngkGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLyngkGameState>
    ): action is HydratedPlacePiece {
        return isPlacePiece(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLyngkGameState>
    ): ActionType[] {
        return [ActionType.PlacePiece]
    }

    enter(context: MachineContext<HydratedLyngkGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        _action: HydratedPlacePiece,
        context: MachineContext<HydratedLyngkGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        const firstId = gameState.firstPlayerId()
        if (gameState.board.isFull()) {
            gameState.turnManager.startTurn(gameState.opponentOf(firstId), gameState.actionCount)
            return MachineState.TakingTurn
        }
        if (setupFromConfig(context.gameConfig) === LyngkSetup.TakeTurns) {
            gameState.turnManager.startNextTurn(gameState.actionCount)
        } else {
            gameState.turnManager.startTurn(firstId, gameState.actionCount)
        }
        return MachineState.PlacingPieces
    }
}
