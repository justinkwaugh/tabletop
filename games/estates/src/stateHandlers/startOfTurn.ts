import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedStartAuction, isStartAuction, StartAuction } from '../actions/startAuction.js'
import { HydratedDrawRoof, isDrawRoof } from '../actions/drawRoof.js'
import { HydratedEmbezzle, isEmbezzle } from '../actions/embezzle.js'

type StartOfTurnAction = HydratedDrawRoof | HydratedStartAuction | HydratedEmbezzle

// Transition from StartOfTurn(DrawRoof) -> Auctioning
//                 StartOfTurn(StartAuction) -> Auctioning

export class StartOfTurnStateHandler
    implements MachineStateHandler<StartOfTurnAction, HydratedEstatesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedEstatesGameState>
    ): action is StartOfTurnAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.DrawRoof ||
            action.type === ActionType.StartAuction ||
            action.type === ActionType.Embezzle
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEstatesGameState>
    ): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState

        if (gameState.board.validRoofLocations().length > 0) {
            validActions.push(ActionType.DrawRoof)
        }

        if (gameState.placeableCubes().length > 0) {
            validActions.push(ActionType.StartAuction)
        }

        if (HydratedEmbezzle.canEmbezzle(playerId, gameState)) {
            validActions.push(ActionType.Embezzle)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedEstatesGameState>) {
        const gameState = context.gameState

        // If we are not still in the middle of a turn, start a new turn
        if (!gameState.turnManager.currentTurn()) {
            const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
            gameState.activePlayerIds = [nextPlayerId]
        }
    }

    onAction(
        action: StartOfTurnAction,
        context: MachineContext<HydratedEstatesGameState>
    ): MachineState {
        const gameState = context.gameState
        switch (true) {
            case isDrawRoof(action): {
                context.addSystemAction(StartAuction, {
                    playerId: action.playerId,
                    piece: gameState.chosenPiece
                })
                return MachineState.StartOfTurn
            }
            case isStartAuction(action): {
                return MachineState.Auctioning
            }
            case isEmbezzle(action): {
                return MachineState.StartOfTurn
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
