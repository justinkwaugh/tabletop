import { isMarketTile, isStallTile, type Tile } from '@tabletop/fresh-fish'
import { getGoodsName } from './goodsNames.js'

export function getTileName(tile: Tile): string {
    switch (true) {
        case isMarketTile(tile):
            return 'market'
        case isStallTile(tile):
            return `${getGoodsName(tile.goodsType)} stall`
    }
    return 'Unknown'
}
