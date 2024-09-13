import type { GameAction } from '@tabletop/common'
import {
    isDrawTile,
    isEndAuction,
    isPlaceDisk,
    isPlaceMarket,
    isPlaceStall,
    isStallTile
} from '@tabletop/fresh-fish'
import { getTileName } from './tileNames.js'
import { getGoodsName } from './goodsNames.js'

export function getDescriptionForAction(action: GameAction) {
    switch (true) {
        case isDrawTile(action): {
            const tileDesc = action.metadata?.chosenTile
                ? getTileName(action.metadata.chosenTile)
                : ''
            return `drew a ${tileDesc} tile${isStallTile(action.metadata?.chosenTile) ? ' and put it up for auction' : ''}`
        }
        case isPlaceDisk(action):
            return 'placed a disk on the board'
        case isPlaceMarket(action):
            return 'drew and placed a market tile'
        case isPlaceStall(action):
            if (action.coords) {
                return `placed a ${getGoodsName(action.goodsType)} stall on the board`
            } else {
                return `had to place a ${getGoodsName(action.goodsType)} stall, but did not have a reserved location so the stall was discarded`
            }
        case isEndAuction(action):
            return 'The auction has ended:'
        default:
            return action.type
    }
}
