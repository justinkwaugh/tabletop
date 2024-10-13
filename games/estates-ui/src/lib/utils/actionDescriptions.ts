import type { GameAction } from '@tabletop/common'
import {
    AuctionRecipient,
    isChooseRecipient,
    isDiscardPiece,
    isEmbezzle,
    isEndAuction,
    isPlaceBarrier,
    isPlaceBid,
    isPlaceCube,
    isPlaceMayor,
    isPlaceRoof,
    isRemoveBarrier,
    isStartAuction
} from '@tabletop/estates'

export function getDescriptionForAction(action: GameAction) {
    switch (true) {
        case isEndAuction(action):
            if (action.winnerId) {
                return 'bid the most at $' + action.highBid
            } else {
                return 'recieved the piece for free'
            }
        case isPlaceBid(action):
            return action.amount > 0 ? 'placed a bid of $' + action.amount : 'passed'
        case isStartAuction(action):
            return 'started an auction'
        case isPlaceCube(action):
            return 'placed a cube on the board'
        case isPlaceBarrier(action):
            return 'placed a barrier on the board'
        case isPlaceRoof(action):
            return 'placed a roof on the board'
        case isPlaceMayor(action):
            return 'placed a mayor on the board'
        case isRemoveBarrier(action):
            return 'removed a barrier from the board'
        case isDiscardPiece(action):
            return 'discarded their piece'
        case isEmbezzle(action):
            return 'stole $1'
        case isChooseRecipient(action):
            if (action.recipient === AuctionRecipient.Auctioneer) {
                return 'chose to buy out the winner'
            } else {
                return 'did not buy out the winner'
            }
        default:
            return action.type
    }
}
