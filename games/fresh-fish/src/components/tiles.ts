import { Type, type Static } from '@sinclair/typebox'
import { GoodsType } from '../definition/goodsType.js'

export enum TileType {
    Market = 'market',
    Stall = 'stall'
}

export type MarketTile = Static<typeof MarketTile>
export const MarketTile = Type.Object({
    type: Type.Const(TileType.Market),
    test: Type.Optional(Type.String())
})

export type StallTile = Static<typeof StallTile>
export const StallTile = Type.Object({
    type: Type.Const(TileType.Stall),
    goodsType: Type.Enum(GoodsType)
})

export type Tile = Static<typeof Tile>
export const Tile = Type.Union([MarketTile, StallTile])

export function isStallTile(tile?: Tile): tile is StallTile {
    return tile?.type === TileType.Stall
}

export function isMarketTile(tile?: Tile): tile is MarketTile {
    return tile?.type === TileType.Market
}

export function generateMarketTile(): MarketTile {
    return { type: TileType.Market }
}

export function generateStallTile(goodsType: GoodsType): StallTile {
    return { type: TileType.Stall, goodsType: goodsType }
}
