import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedResolveAuction, isResolveAuction } from '../actions/resolveAuction.js'
import {
    HydratedCompleteAntiqueSet,
    isCompleteAntiqueSet,
    isNextAntiqueSetCompletion
} from '../actions/completeAntiqueSet.js'
import { queueAntiqueSetCompletions, queueAuctionResolution } from '../util/automaticActions.js'
import { stateAfterTurnAction } from '../util/turns.js'

type BiddingAction = HydratedPlaceBid | HydratedResolveAuction | HydratedCompleteAntiqueSet

export class BiddingStateHandler implements MachineStateHandler<
    BiddingAction,
    HydratedMarracashGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMarracashGameState>
    ): action is BiddingAction {
        if (isPlaceBid(action)) {
            return (
                this.isAwaitingBid(context.gameState, action.playerId) &&
                (action.source === ActionSource.System ||
                    this.canBid(context.gameState, action.playerId))
            )
        }
        if (isCompleteAntiqueSet(action)) {
            return isNextAntiqueSetCompletion(action, context.gameState)
        }
        return isResolveAuction(action) && context.gameState.auction?.bidding.winnerId !== undefined
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMarracashGameState>
    ): ActionType[] {
        return this.isAwaitingBid(context.gameState, playerId) &&
            this.canBid(context.gameState, playerId)
            ? [ActionType.PlaceBid]
            : []
    }

    enter(context: MachineContext<HydratedMarracashGameState>) {
        const gameState = context.gameState
        assertExists(gameState.auction, 'Bidding requires an auction')
        gameState.activePlayerIds = gameState.auction.awaitingBidderIds()
    }

    onAction(
        action: BiddingAction,
        context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        const gameState = context.gameState
        switch (true) {
            case isPlaceBid(action): {
                if (gameState.auction?.bidding.allBidsSubmitted()) {
                    queueAuctionResolution(context)
                }
                return MachineState.Bidding
            }
            case isCompleteAntiqueSet(action): {
                return MachineState.Bidding
            }
            case isResolveAuction(action): {
                if (gameState.pendingAntiqueSets.length > 0) {
                    queueAntiqueSetCompletions(context)
                    return MachineState.ChoosingAction
                }
                return stateAfterTurnAction(context)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isAwaitingBid(gameState: HydratedMarracashGameState, playerId: string): boolean {
        return gameState.auction?.awaitingBidderIds().includes(playerId) ?? false
    }

    private canBid(gameState: HydratedMarracashGameState, playerId: string): boolean {
        return !gameState.isAtShopLimit(playerId)
    }
}
