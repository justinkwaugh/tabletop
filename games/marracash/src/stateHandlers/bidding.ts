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
import { MaxShopsPerPlayer } from '../components/payments.js'
import {
    queueAntiqueSetCompletions,
    queueAuctionResolution,
    queueAutomaticPasses
} from '../util/automaticActions.js'

type BiddingAction = HydratedPlaceBid | HydratedResolveAuction

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
        return isResolveAuction(action) && context.gameState.auction?.winnerId !== undefined
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
        const auction = gameState.auction
        assertExists(auction, 'Bidding requires an auction')
        gameState.activePlayerIds = auction.participants
            .filter((participant) => !participant.submitted)
            .map((participant) => participant.playerId)
        if (auction.participants.every((participant) => !participant.submitted)) {
            queueAutomaticPasses(context)
        }
    }

    onAction(
        action: BiddingAction,
        context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        const gameState = context.gameState
        switch (true) {
            case isPlaceBid(action): {
                if (gameState.auction?.allBidsSubmitted()) {
                    queueAuctionResolution(context)
                }
                return MachineState.Bidding
            }
            case isResolveAuction(action): {
                queueAntiqueSetCompletions(context)
                return MachineState.ChoosingAction
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isAwaitingBid(gameState: HydratedMarracashGameState, playerId: string): boolean {
        const participant = gameState.auction?.participants.find(
            (candidate) => candidate.playerId === playerId
        )
        return participant !== undefined && !participant.submitted
    }

    private canBid(gameState: HydratedMarracashGameState, playerId: string): boolean {
        return gameState.ownedShopCount(playerId) < MaxShopsPerPlayer
    }
}
