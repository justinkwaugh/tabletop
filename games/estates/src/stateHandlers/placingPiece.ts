import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceCube, isPlaceCube } from '../actions/placeCube.js'
import { isBarrier, isCancelCube, isCube, isMayor, isRoof } from '../components/pieces.js'
import { isPlaceMayor } from '../actions/placeMayor.js'
import { isPlaceRoof } from '../actions/placeRoof.js'
import { isPlaceBarrier } from '../actions/placeBarrier.js'
import { isRemoveBarrier } from '../actions/removeBarrier.js'
import { isDiscardPiece } from '../actions/discardPiece.js'

// Transition from PlacingPiece(PlaceRoof) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceCube) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceMayor) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceBarrier) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceCancelCube) -> StartOfTurn | EndofGame
//                 PlacingPiece(DiscardPiece) -> StartOfTurn | EndofGame

type PlacingPieceAction = HydratedPlaceCube

export class PlacingPieceStateHandler implements MachineStateHandler<PlacingPieceAction, HydratedEstatesGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedEstatesGameState>): action is PlacingPieceAction {
        if (!action.playerId) return false
        return (
            isPlaceCube(action) ||
            isPlaceMayor(action) ||
            isPlaceRoof(action) ||
            isPlaceBarrier(action) ||
            isRemoveBarrier(action) ||
            isDiscardPiece(action)
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedEstatesGameState>): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState

        switch (true) {
            case isCube(gameState.chosenPiece): {
                validActions.push(ActionType.PlaceCube)
                break
            }
            case isMayor(gameState.chosenPiece): {
                validActions.push(ActionType.PlaceMayor)
                validActions.push(ActionType.DiscardPiece)
                break
            }
            case isRoof(gameState.chosenPiece): {
                validActions.push(ActionType.PlaceRoof)
                break
            }
            case isBarrier(gameState.chosenPiece): {
                validActions.push(ActionType.PlaceBarrier)
                validActions.push(ActionType.DiscardPiece)
                break
            }
            case isCancelCube(gameState.chosenPiece): {
                if (gameState.board.getBarriers().length > 0) {
                    validActions.push(ActionType.RemoveBarrier)
                }
                validActions.push(ActionType.DiscardPiece)
                break
            }
        }

        return validActions
    }

    enter(context: MachineContext<HydratedEstatesGameState>) {
        const gameState = context.gameState
        if (!gameState.recipient) {
            throw Error(`No recipient found`)
        }
        gameState.activePlayerIds = [gameState.recipient]
    }

    onAction(action: PlacingPieceAction, context: MachineContext<HydratedEstatesGameState>): MachineState {
        const gameState = context.gameState
        if (
            !isPlaceCube(action) &&
            !isPlaceMayor(action) &&
            !isPlaceRoof(action) &&
            !isPlaceBarrier(action) &&
            !isRemoveBarrier(action) &&
            !isDiscardPiece(action)
        ) {
            throw Error('Invalid action type')
        }

        gameState.chosenPiece = undefined
        gameState.recipient = undefined
        gameState.embezzled = false
        gameState.turnManager.endTurn(gameState.actionCount)

        for (const player of gameState.players) {
            player.score = gameState.calculatePlayerScore(player)
        }

        if (gameState.isEndOfGame()) {
            return MachineState.EndOfGame
        } else {
            return MachineState.StartOfTurn
        }
    }
}
