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
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { EndAuction, HydratedEndAuction, isEndAuction } from '../actions/endAuction.js'
import { AuctionRecipient, ChooseRecipient } from '../actions/chooseRecipient.js'

// Transition from Auctioning(PlaceBid) -> Auctioning
//                 Auctioning(EndAuction) -> AuctionEnded

type AuctioningAction = HydratedPlaceBid | HydratedEndAuction

export class AuctioningStateHandler implements MachineStateHandler<AuctioningAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is AuctioningAction {
        if (!action.playerId) return false
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
        }
    }

    onAction(action: AuctioningAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedEstatesGameState
        const currentAuction = gameState.auction
        if (!currentAuction || !currentAuction.auctioneerId) {
            throw Error(`No auction found or no auctioneer`)
        }
        switch (true) {
            case isPlaceBid(action): {
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
                    const chooseRecipientAction: ChooseRecipient = {
                        type: ActionType.ChooseRecipient,
                        id: nanoid(),
                        playerId: currentAuction.auctioneerId,
                        gameId: action.gameId,
                        source: ActionSource.System,
                        recipient: AuctionRecipient.Auctioneer
                    }
                    context.addPendingAction(chooseRecipientAction)
                } else {
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
