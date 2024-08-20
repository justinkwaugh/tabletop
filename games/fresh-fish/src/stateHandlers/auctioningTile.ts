import {
    ActionSource,
    HydratedAction,
    MachineContext,
    type MachineStateHandler,
    remove
} from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { MachineState } from '../definition/states.js'
import { nanoid } from 'nanoid'
import { PlaceStall } from '../actions/placeStall.js'
import { isStallTile } from '../components/tiles.js'
import { ActionType } from '../definition/actions.js'
import { EndAuction, HydratedEndAuction, isEndAuction } from '../actions/endAuction.js'

type AuctioningTileAction = HydratedPlaceBid | HydratedEndAuction

// Transition from AuctioningTile(PlaceBid) -> AuctionEnded (if all bids placed)
//                 AuctioningTile(PlaceBid) -> AuctioningTile (if not all bids placed)
export class AuctioningTileStateHandler implements MachineStateHandler<HydratedPlaceBid> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedPlaceBid {
        if (!isPlaceBid(action) && !isEndAuction(action)) {
            return false
        }

        const gameState = context.gameState as HydratedFreshFishGameState

        if (
            isPlaceBid(action) &&
            (!this.canPlayerParticipate(context, action.playerId) ||
                gameState.getPlayerState(action.playerId).money < action.amount)
        ) {
            return false
        }

        if (isEndAuction(action) && !this.isValidEndAuction(context)) {
            return false
        }

        return true
    }

    validActionsForPlayer(playerId: string, context: MachineContext): string[] {
        return this.canPlayerParticipate(context, playerId) ? [ActionType.PlaceBid] : []
    }

    enter(_context: MachineContext) {}

    onAction(action: AuctioningTileAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedFreshFishGameState

        switch (action.type) {
            case ActionType.PlaceBid: {
                const currentAuction = gameState.currentAuction
                if (!currentAuction) {
                    throw Error(`No auction found but auction was started`)
                }

                remove(gameState.activePlayerIds, action.playerId)

                // Continue if still players left to bid
                if (gameState.activePlayerIds.length > 0) {
                    return MachineState.AuctioningTile
                }

                // End the auction
                const winnerId = currentAuction.winnerId
                if (!winnerId) {
                    throw Error(`No auction winner found but no one left to bid`)
                }

                const endAuctionAction: EndAuction = {
                    type: ActionType.EndAuction,
                    id: nanoid(),
                    gameId: action.gameId,
                    source: ActionSource.System,
                    winnerId: winnerId,
                    highBid: currentAuction.highBid ?? 0,
                    revealsInfo: true
                }

                context.addPendingAction(endAuctionAction)
                gameState.activePlayerIds = []

                return MachineState.AuctioningTile
            }
            case ActionType.EndAuction: {
                // The winner has to place a stall
                const winningPlayer = gameState.getPlayerState(action.winnerId)
                gameState.activePlayerIds = [action.winnerId]

                const chosenTile = gameState.chosenTile
                if (!isStallTile(chosenTile)) {
                    throw Error(`The auctioned tile was not a stall`)
                }

                // Oops, player didn't have anywhere to put the stall, so we auto-place it into the void
                if (!winningPlayer.hasDiskOnBoard()) {
                    const placeStallAction: PlaceStall = {
                        type: ActionType.PlaceStall,
                        id: nanoid(),
                        gameId: action.gameId,
                        source: ActionSource.System,
                        playerId: winningPlayer.playerId,
                        goodsType: chosenTile.goodsType
                    }
                    context.addPendingAction(placeStallAction)
                }
                return MachineState.AuctionEnded
            }
        }
    }

    private canPlayerParticipate(context: MachineContext, playerId?: string): boolean {
        if (!playerId) return false
        const gameState = context.gameState as HydratedFreshFishGameState
        const goodsType = gameState.getAuctionGoodsType()
        if (!goodsType) {
            return false
        }
        return gameState.getPlayerState(playerId).hasUnplacedStall(goodsType)
    }

    private isValidEndAuction(context: MachineContext): boolean {
        const gameState = context.gameState as HydratedFreshFishGameState
        const auction = gameState.currentAuction
        return auction !== undefined && auction.winnerId !== undefined
    }
}
