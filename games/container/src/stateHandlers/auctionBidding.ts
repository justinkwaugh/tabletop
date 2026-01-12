import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { HydratedSubmitBid, isSubmitBid } from '../actions/submitBid.js'
import { HydratedTakeLoan, isTakeLoan } from '../actions/takeLoan.js'

export type AuctionBiddingAction = HydratedSubmitBid | HydratedTakeLoan

export class AuctionBiddingStateHandler
    implements MachineStateHandler<AuctionBiddingAction>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext
    ): action is AuctionBiddingAction {
        const state = context.gameState as HydratedContainerGameState
        const auction = state.auction
        if (!action.playerId || !auction) {
            return false
        }
        if (isSubmitBid(action)) {
            if (!HydratedSubmitBid.canBid(state, action.playerId)) {
                return false
            }
            const currentTotal = auction.totalBids[action.playerId] ?? 0
            const newTotal =
                auction.phase === 'tiebreak'
                    ? currentTotal + action.bidAmount
                    : action.bidAmount
            const player = state.getPlayerState(action.playerId)
            return player.money >= newTotal && action.bidAmount >= 0
        }

        if (isTakeLoan(action)) {
            return HydratedTakeLoan.canTake(state, action.playerId)
        }

        return false
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const state = context.gameState as HydratedContainerGameState
        const auction = state.auction
        if (!auction) {
            return []
        }

        const participant = auction.round.participants.find(
            (entry) => entry.playerId === playerId
        )
        if (!participant || participant.bid !== undefined) {
            return []
        }

        const actions = [ActionType.SubmitBid]
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
        state.activePlayerIds = auction.round.participants
            .filter((participant) => participant.bid === undefined)
            .map((participant) => participant.playerId)
    }

    onAction(action: AuctionBiddingAction, context: MachineContext): MachineState {
        const state = context.gameState as HydratedContainerGameState
        const auction = state.auction
        if (!auction) {
            return MachineState.TakingActions
        }

        if (isTakeLoan(action)) {
            return MachineState.AuctionBidding
        }

        if (!auction.isRoundComplete()) {
            return MachineState.AuctionBidding
        }

        const resolution = auction.resolveRound()
        if (resolution === 'tiebreak') {
            return MachineState.AuctionBidding
        }

        state.activePlayerIds = [auction.sellerId]
        return MachineState.AuctionResolve
    }
}
