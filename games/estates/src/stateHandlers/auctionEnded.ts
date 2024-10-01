import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedChooseRecipient, isChooseRecipient } from '../actions/chooseRecipient.js'

// Transition from AuctionEnded(ChooseRecipient) -> PlacingPiece

export class AuctionEndedStateHandler implements MachineStateHandler<HydratedChooseRecipient> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext
    ): action is HydratedChooseRecipient {
        if (!action.playerId) return false
        return isChooseRecipient(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState as HydratedEstatesGameState

        if (playerId === gameState.auction?.auctioneerId) {
            validActions.push(ActionType.ChooseRecipient)
        }

        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedEstatesGameState
        const auctioneer = gameState.auction?.auctioneerId
        if (!auctioneer) {
            throw Error(`No auctioneer found`)
        }
        gameState.activePlayerIds = [auctioneer]
    }

    onAction(action: HydratedChooseRecipient, _context: MachineContext): MachineState {
        switch (true) {
            case isChooseRecipient(action): {
                return MachineState.PlacingPiece
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
