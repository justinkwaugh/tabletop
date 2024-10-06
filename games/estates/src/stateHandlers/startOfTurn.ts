import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { nanoid } from 'nanoid'
import { ActionType } from '../definition/actions.js'
import { HydratedStartAuction, isStartAuction, StartAuction } from '../actions/startAuction.js'
import { HydratedDrawRoof, isDrawRoof } from '../actions/drawRoof.js'

type StartOfTurnAction = HydratedDrawRoof | HydratedStartAuction

// Transition from StartOfTurn(DrawRoof) -> Auctioning
//                 StartOfTurn(StartAuction) -> Auctioning

export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is StartOfTurnAction {
        if (!action.playerId) return false
        return action.type === ActionType.DrawRoof || action.type === ActionType.StartAuction
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState as HydratedEstatesGameState

        if (gameState.board.validRoofLocations().length > 0) {
            validActions.push(ActionType.DrawRoof)
        }

        if (gameState.placeableCubes().length > 0) {
            validActions.push(ActionType.StartAuction)
        }

        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedEstatesGameState

        // If we are not still in the middle of a turn, start a new turn
        if (!gameState.turnManager.currentTurn()) {
            const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
            gameState.activePlayerIds = [nextPlayerId]
        }
    }

    onAction(action: StartOfTurnAction, context: MachineContext): MachineState {
        switch (true) {
            case isDrawRoof(action): {
                const startAuctionAction = <StartAuction>{
                    type: ActionType.StartAuction,
                    id: nanoid(),
                    playerId: action.playerId,
                    gameId: action.gameId,
                    source: ActionSource.System
                }
                context.addPendingAction(startAuctionAction)
                return MachineState.StartOfTurn
            }
            case isStartAuction(action): {
                return MachineState.Auctioning
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}