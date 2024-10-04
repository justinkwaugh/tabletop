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
import { HydratedPlaceBid, isPlaceBid, PlaceBid } from '../actions/placeBid.js'
import { EndAuction, HydratedEndAuction, isEndAuction } from '../actions/endAuction.js'
import { AuctionRecipient, ChooseRecipient } from '../actions/chooseRecipient.js'

// Transition from Auctioning(PlaceBid) -> Auctioning
//                 Auctioning(EndAuction) -> AuctionEnded

type AuctioningAction = HydratedPlaceBid | HydratedEndAuction

export class AuctioningStateHandler implements MachineStateHandler<AuctioningAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is AuctioningAction {
        if (!action.playerId && !isEndAuction(action)) return false
        return isPlaceBid(action) || isEndAuction(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState as HydratedEstatesGameState
        const playerState = gameState.getPlayerState(playerId)

        if (playerState.money > 0) {
            validActions.push(ActionType.PlaceBid)
        }

        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedEstatesGameState
        const nextBidder = gameState.auction?.nextBidder()
        if (nextBidder) {
            gameState.activePlayerIds = [nextBidder]
            const auction = gameState.auction
            if (!auction) {
                throw Error(`No auction found`)
            }
            // Auto Pass if player doesn't have enough money to bid
            const bidderState = gameState.getPlayerState(nextBidder)
            if (bidderState.money < (auction.highBid ?? 0) + 1) {
                const passAction: PlaceBid = {
                    type: ActionType.PlaceBid,
                    id: nanoid(),
                    playerId: nextBidder,
                    gameId: gameState.gameId,
                    source: ActionSource.System,
                    amount: 0
                }
                context.addPendingAction(passAction)
            }
        }
    }

    onAction(action: AuctioningAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedEstatesGameState

        switch (true) {
            case isPlaceBid(action): {
                const currentAuction = gameState.auction
                if (!currentAuction || !currentAuction.auctioneerId) {
                    throw Error(`No auction found or no auctioneer`)
                }
                if (!currentAuction.isAuctionComplete()) {
                    return MachineState.Auctioning
                }

                const endAuctionAction: EndAuction = {
                    type: ActionType.EndAuction,
                    id: nanoid(),
                    gameId: action.gameId,
                    source: ActionSource.System,
                    winnerId: currentAuction.winnerId,
                    highBid: currentAuction.highBid ?? 0
                }

                context.addPendingAction(endAuctionAction)
                return MachineState.Auctioning
            }
            case isEndAuction(action): {
                if (!action.winnerId) {
                    return MachineState.PlacingPiece
                } else {
                    const currentAuction = gameState.auction
                    if (!currentAuction || !currentAuction.auctioneerId) {
                        throw Error(`No auction found or no auctioneer`)
                    }
                    const auctioneer = gameState.getPlayerState(currentAuction.auctioneerId)
                    if (auctioneer.money < action.highBid) {
                        const chooseRecipientAction: ChooseRecipient = {
                            type: ActionType.ChooseRecipient,
                            id: nanoid(),
                            playerId: currentAuction.auctioneerId,
                            gameId: action.gameId,
                            source: ActionSource.System,
                            recipient: AuctionRecipient.HighestBidder
                        }
                        context.addPendingAction(chooseRecipientAction)
                    }
                }
                return MachineState.AuctionEnded
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
