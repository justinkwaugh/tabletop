import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedMovePiece, isMovePiece } from '../actions/movePiece.js'
import { HydratedPunctGameState } from '../model/gameState.js'
import { outcomeAfter } from './turnFlow.js'

type TakingTurnAction = HydratedPlacePiece | HydratedMovePiece

// Rule B: a turn adds a piece to the board or moves one already in play.
export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedPunctGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedPunctGameState>
    ): action is TakingTurnAction {
        return isPlacePiece(action) || isMovePiece(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedPunctGameState>
    ): ActionType[] {
        const { gameState } = context
        return [
            ...(gameState.canPlace(playerId) ? [ActionType.PlacePiece] : []),
            ...(gameState.canMove(playerId) ? [ActionType.MovePiece] : [])
        ]
    }

    enter(context: MachineContext<HydratedPunctGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedPunctGameState>
    ): MachineState {
        const { gameState } = context
        const outcome = outcomeAfter(gameState, action.playerId, isPlacePiece(action))
        gameState.turnManager.endTurn(gameState.actionCount)
        switch (outcome.kind) {
            case 'won':
                gameState.declareWinner(outcome.winnerId, outcome.reason)
                return MachineState.EndOfGame
            case 'drawn':
                gameState.declareDraw(outcome.reason)
                return MachineState.EndOfGame
            case 'next':
                gameState.turnManager.startTurn(outcome.playerId, gameState.actionCount)
                return MachineState.TakingTurn
        }
    }
}
