import {
    BaseGameInitializer,
    GameInitializer,
    GameState,
    Prng,
    RandomFunction,
    UninitializedGameState
} from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle
} from '@tabletop/common'
import { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishPlayerState, HydratedFreshFishPlayerState } from '../model/playerState.js'
import { HydratedTileBag, TileBag } from '../components/tileBag.js'

import { GoodsType } from './goodsType.js'

import { MachineState } from './states.js'
import { StallTile, TileType } from '../components/tiles.js'
import { generateBoard } from '../util/boardGenerator.js'
import { FreshFishColors } from './colors.js'

export class FreshFishGameInitializer extends BaseGameInitializer implements GameInitializer {
    initializeExplorationState(state: GameState): GameState {
        const hydratedState = new HydratedFreshFishGameState(state as FreshFishGameState)
        hydratedState.tileBag.shuffle()
        return hydratedState.dehydrate()
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng.random)
        const turnManager = HydratedSimpleTurnManager.generate(players, prng.random)
        const finalStalls = Object.values(GoodsType).map(
            (goodsType) => <StallTile>{ type: TileType.Stall, goodsType }
        )
        shuffle(finalStalls, prng.random)

        const { board, numMarketTiles } = generateBoard(game.players.length, prng.random)

        const freshFishState: FreshFishGameState = Object.assign(state, {
            players: players,
            turnManager: turnManager,
            machineState: MachineState.StartOfTurn,
            tileBag: this.initializeTileBag(game, numMarketTiles, prng.random),
            board,
            finalStalls: finalStalls
        })

        const initialState = new HydratedFreshFishGameState(freshFishState)
        initialState.score()
        return initialState
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
