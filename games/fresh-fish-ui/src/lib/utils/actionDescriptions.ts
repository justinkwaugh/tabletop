import type { GameAction } from '@tabletop/common'
import {
    isDrawTile,
    isEndAuction,
    isPass,
    isPlaceBid,
    isPlaceDisk,
    isPlaceMarket,
    isPlaceStall,
    isStallTile,
    isStartAuction
} from '@tabletop/fresh-fish'
import { getTileName } from './tileNames.js'
import { getGoodsName } from './goodsNames.js'

export function getDescriptionForAction(action: GameAction) {
    switch (true) {
        case isDrawTile(action): {
            const tile = action.metadata?.chosenTile
            if (isStallTile(tile)) {
                return `auctioned a ${getGoodsName(tile.goodsType)} stall`
            }
            return `drew a ${tile ? getTileName(tile) : ''} tile`
        }
        case isPlaceDisk(action):
            return 'placed a disc'
        case isPlaceMarket(action):
            return 'placed a market'
        case isPlaceStall(action):
            if (action.coords) {
                return `placed a ${getGoodsName(action.goodsType)} stall`
            } else {
                return `had to discard the ${getGoodsName(action.goodsType)} stall`
            }
        case isEndAuction(action):
            return 'The auction has ended'
        case isPlaceBid(action):
            return 'placed a bid'
        case isStartAuction(action):
            if (action.metadata) {
                return `auctioned a ${getGoodsName(action.metadata.goodsType)} stall`
            } else {
                return `started an auction`
            }
        case isPass(action):
            return 'passed'
        default:
            return action.type
    }
}
