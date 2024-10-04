import type { GameAction } from '@tabletop/common'
import {
    AuctionRecipient,
    isChooseRecipient,
    isEndAuction,
    isPlaceBid,
    isPlaceCube,
    isStartAuction
} from '@tabletop/estates'

export function getDescriptionForAction(action: GameAction) {
    switch (true) {
        case isEndAuction(action):
            return 'The auction has ended:'
        case isPlaceBid(action):
            return 'placed a bid of $' + action.amount
        case isStartAuction(action):
            return 'started an auction'
        case isPlaceCube(action):
            return 'placed a cube on the board'
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
