import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceCube, isPlaceCube } from '../actions/placeCube.js'
import { isCube, isMayor } from '../components/pieces.js'
import { isPlaceMayor } from '../actions/placeMayor.js'

// Transition from PlacingPiece(PlaceRoof) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceCube) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceMayor) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceBarrier) -> StartOfTurn | EndofGame
//                 PlacingPiece(PlaceCancelCube) -> StartOfTurn | EndofGame
//                 PlacingPiece(DiscardPiece) -> StartOfTurn | EndofGame

type PlacingPieceAction = HydratedPlaceCube

export class PlacingPieceStateHandler implements MachineStateHandler<PlacingPieceAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is PlacingPieceAction {
        if (!action.playerId) return false
        return isPlaceCube(action) || isPlaceMayor(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState as HydratedEstatesGameState

        switch (true) {
            case isCube(gameState.chosenPiece): {
                validActions.push(ActionType.PlaceCube)
                break
            }
            case isMayor(gameState.chosenPiece): {
                validActions.push(ActionType.PlaceMayor)
                break
            }
        }

        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedEstatesGameState
        if (!gameState.recipient) {
            throw Error(`No recipient found`)
        }
        gameState.activePlayerIds = [gameState.recipient]
    }

    onAction(action: PlacingPieceAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedEstatesGameState
        if (!isPlaceCube(action) && !isPlaceMayor(action)) {
            throw Error('Invalid action type')
        }

        gameState.chosenPiece = undefined
        gameState.recipient = undefined
        gameState.turnManager.endTurn(gameState.actionCount)
        return MachineState.StartOfTurn
    }
}
