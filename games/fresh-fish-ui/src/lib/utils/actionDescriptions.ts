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
            const tileDesc = action.metadata?.chosenTile
                ? getTileName(action.metadata.chosenTile)
                : ''
            return `drew a ${tileDesc} tile${isStallTile(action.metadata?.chosenTile) ? ' and put it up for auction' : ''}`
        }
        case isPlaceDisk(action):
            return 'placed a disk'
        case isPlaceMarket(action):
            return 'drew and placed a market tile'
        case isPlaceStall(action):
            if (action.coords) {
                return `placed a ${getGoodsName(action.goodsType)} stall`
            } else {
                return `had to place a ${getGoodsName(action.goodsType)} stall, but did not have a reserved location so the stall was discarded`
            }
        case isEndAuction(action):
            return 'The auction has ended'
        case isPlaceBid(action):
            return 'placed a bid'
        case isStartAuction(action):
            if (action.metadata) {
                return `started a ${getGoodsName(action.metadata.goodsType)} stall auction`
            } else {
                return `started an auction`
            }
        case isPass(action):
            return 'passed'
        default:
            return action.type
    }
}
