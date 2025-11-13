import { type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GoodsType } from '../definition/goodsType.js'
import { Tile, generateMarketTile, generateStallTile } from './tiles.js'
import { HydratedDrawBag, DrawBag, type RandomFunction } from '@tabletop/common'

export type TileBag = Static<typeof TileBag>
export const TileBag = DrawBag(Tile)

export const TileBagValidator = TypeCompiler.Compile(TileBag)

export class HydratedTileBag extends HydratedDrawBag<Tile, typeof TileBag> implements TileBag {
    static generate(
        numMarket: number,
        numFish: number,
        numCheese: number,
        numIceCream: number,
        numLemonade: number,
        random: RandomFunction
    ) {
        const newTiles: Tile[] = []
        for (let i: number = 0; i < numMarket; i++) {
            newTiles.push(generateMarketTile())
        }
        for (let i: number = 0; i < numFish; i++) {
            newTiles.push(generateStallTile(GoodsType.Fish))
        }
        for (let i: number = 0; i < numCheese; i++) {
            newTiles.push(generateStallTile(GoodsType.Cheese))
        }
        for (let i: number = 0; i < numIceCream; i++) {
            newTiles.push(generateStallTile(GoodsType.IceCream))
        }
        for (let i: number = 0; i < numLemonade; i++) {
            newTiles.push(generateStallTile(GoodsType.Lemonade))
        }

        const tileBag: TileBag = {
            items: newTiles,
            remaining: newTiles.length
        }

        const hydratedTileBag = new HydratedTileBag(tileBag)
        hydratedTileBag.shuffle(random)
        return hydratedTileBag
    }

    constructor(data: TileBag) {
        super(data, TileBagValidator)
    }
}
