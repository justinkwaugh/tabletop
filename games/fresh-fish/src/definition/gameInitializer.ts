import {
    BaseGameInitializer,
    GameInitializer,
    generateSeed,
    Prng,
    PrngState,
    RandomFunction
} from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle
} from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishPlayerState, HydratedFreshFishPlayerState } from '../model/playerState.js'
import { HydratedTileBag, TileBag } from '../components/tileBag.js'

import { nanoid } from 'nanoid'
import { GoodsType } from './goodsType.js'

import { MachineState } from './states.js'
import { StallTile, TileType } from '../components/tiles.js'
import { generateBoard } from '../util/boardGenerator.js'
import { FreshFishColors } from './colors.js'

export class FreshFishGameInitializer extends BaseGameInitializer implements GameInitializer {
    initializeGameState(game: Game, seed?: number): HydratedGameState {
        seed = seed === undefined ? generateSeed() : seed
        const prngState: PrngState = { seed, invocations: 0 }
        const prng = new Prng(prngState)
        const players = this.initializePlayers(game, prng.random)
        const turnManager = HydratedSimpleTurnManager.generate(players, prng.random)
        const finalStalls = Object.values(GoodsType).map(
            (goodsType) => <StallTile>{ type: TileType.Stall, goodsType }
        )
        shuffle(finalStalls, prng.random)

        const { board, numMarketTiles } = generateBoard(game.players.length, prng.random)

        const state = new HydratedFreshFishGameState({
            id: nanoid(),
            gameId: game.id,
            prng: prngState,
            activePlayerIds: [],
            turnManager: turnManager,
            actionCount: 0,
            actionChecksum: 0,
            players: players,
            machineState: MachineState.StartOfTurn,
            winningPlayerIds: [],
            tileBag: this.initializeTileBag(game, numMarketTiles, prng.random),
            board,
            finalStalls: finalStalls
        })

        state.score()

        return state
    }

    private initializePlayers(game: Game, random: RandomFunction): FreshFishPlayerState[] {
        const colors = structuredClone(FreshFishColors)

        shuffle(colors, random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedFreshFishPlayerState({
                playerId: player.id,
                color: colors[index],
                money: 15,
                score: 0,
                stalls: Object.values(GoodsType).map((goodsType) => ({ goodsType, placed: false })),
                disks: 6
            })
        })

        return players
    }

    private initializeTileBag(game: Game, numMarketTiles: number, random: RandomFunction): TileBag {
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
}
