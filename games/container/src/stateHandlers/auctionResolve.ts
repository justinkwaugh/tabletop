import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { HydratedResolveAuction } from '../actions/resolveAuction.js'
import { HydratedTakeLoan, isTakeLoan } from '../actions/takeLoan.js'

export type AuctionResolveAction = HydratedResolveAuction | HydratedTakeLoan

export class AuctionResolveStateHandler
    implements MachineStateHandler<AuctionResolveAction>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext
    ): action is AuctionResolveAction {
        const state = context.gameState as HydratedContainerGameState
        if (!action.playerId) {
            return false
        }
        switch (action.type) {
            case ActionType.ResolveAuction:
                return HydratedResolveAuction.canResolve(state, action.playerId)
            case ActionType.TakeLoan:
                return HydratedTakeLoan.canTake(state, action.playerId)
            default:
                return false
        }
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const state = context.gameState as HydratedContainerGameState
        const auction = state.auction
        if (!auction || auction.sellerId !== playerId) {
            return []
        }
        const actions = [ActionType.ResolveAuction]
        if (HydratedTakeLoan.canTake(state, playerId)) {
            actions.push(ActionType.TakeLoan)
        }
        return actions
    }

    enter(context: MachineContext): void {
        const state = context.gameState as HydratedContainerGameState
        const auction = state.auction
        if (!auction) {
            return
        }
        state.activePlayerIds = [auction.sellerId]
    }

    onAction(action: AuctionResolveAction, context: MachineContext): MachineState {
        const state = context.gameState as HydratedContainerGameState
        if (isTakeLoan(action)) {
            return MachineState.AuctionResolve
        }

        if (state.endTriggered) {
            return MachineState.EndOfGame
        }
        return MachineState.TakingActions
    }
}
