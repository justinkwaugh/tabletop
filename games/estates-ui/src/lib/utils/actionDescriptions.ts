import type { GameAction } from '@tabletop/common'
import { isEndAuction, isPlaceBid, isPlaceCube, isStartAuction } from '@tabletop/estates'

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
        default:
            return action.type
    }
}
