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

export class AuctioningStateHandler implements MachineStateHandler<AuctioningAction, HydratedEstatesGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedEstatesGameState>): action is AuctioningAction {
        if (!action.playerId && !isEndAuction(action)) return false
        return isPlaceBid(action) || isEndAuction(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedEstatesGameState>): ActionType[] {
        const validActions: ActionType[] = []
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(playerId)

        if (playerState.money > 0) {
            validActions.push(ActionType.PlaceBid)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedEstatesGameState>) {
        const gameState = context.gameState

        // No bidders
        if (gameState.auction?.participants.length === 0) {
            context.addSystemAction(EndAuction, {
                winnerId: undefined,
                highBid: 0
            })
        } else {
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
                    context.addSystemAction(PlaceBid, { playerId: nextBidder, amount: 0 })
                }
            }
        }
    }

    onAction(action: AuctioningAction, context: MachineContext<HydratedEstatesGameState>): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isPlaceBid(action): {
                const currentAuction = gameState.auction
                if (!currentAuction || !currentAuction.auctioneerId) {
                    throw Error(`No auction found or no auctioneer`)
                }
                if (!currentAuction.isAuctionComplete()) {
                    return MachineState.Auctioning
                }

                context.addSystemAction(EndAuction, {
                    winnerId: currentAuction.winnerId,
                    highBid: currentAuction.highBid ?? 0
                })
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
                        context.addSystemAction(ChooseRecipient, {
                            playerId: currentAuction.auctioneerId,
                            recipient: AuctionRecipient.HighestBidder
                        })
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
