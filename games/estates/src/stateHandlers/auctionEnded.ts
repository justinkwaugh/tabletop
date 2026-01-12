import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedChooseRecipient, isChooseRecipient } from '../actions/chooseRecipient.js'

// Transition from AuctionEnded(ChooseRecipient) -> PlacingPiece

export class AuctionEndedStateHandler implements MachineStateHandler<HydratedChooseRecipient, HydratedEstatesGameState> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedEstatesGameState>
    ): action is HydratedChooseRecipient {
        if (!action.playerId) return false
        return isChooseRecipient(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedEstatesGameState>): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState

        if (playerId === gameState.auction?.auctioneerId) {
            validActions.push(ActionType.ChooseRecipient)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedEstatesGameState>) {
        const gameState = context.gameState
        const auctioneer = gameState.auction?.auctioneerId
        if (!auctioneer) {
            throw Error(`No auctioneer found`)
        }
        gameState.activePlayerIds = [auctioneer]
    }

    onAction(action: HydratedChooseRecipient, _context: MachineContext<HydratedEstatesGameState>): MachineState {
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
