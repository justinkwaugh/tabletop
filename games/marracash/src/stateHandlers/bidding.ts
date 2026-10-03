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
import { HydratedCompleteAntiqueSet, isCompleteAntiqueSet } from '../actions/completeAntiqueSet.js'
import { MaxShopsPerPlayer } from '../components/payments.js'
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
            return (
                action.source === ActionSource.System &&
                context.gameState.isNextAntiqueSet(action.collectorId)
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
        const participant = gameState.auction?.participants.find(
            (candidate) => candidate.playerId === playerId
        )
        return participant !== undefined && !participant.submitted
    }

    private canBid(gameState: HydratedMarracashGameState, playerId: string): boolean {
        return gameState.ownedShopCount(playerId) < MaxShopsPerPlayer
    }
}
