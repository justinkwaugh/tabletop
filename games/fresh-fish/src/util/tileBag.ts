import type { Game, RandomFunction } from '@tabletop/common'
import { HydratedTileBag, type TileBag } from '../components/tileBag.js'

export function createTileBag(game: Game, numMarketTiles: number, random: RandomFunction): TileBag {
    const numBagStalls = game.players.length - 1
    return HydratedTileBag.generate(
        numMarketTiles,
        numBagStalls,
        numBagStalls,
        numBagStalls,
        numBagStalls,
        random
    )
}
