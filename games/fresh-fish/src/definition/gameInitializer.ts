import {
    BaseGameInitializer,
    type GameInitializer,
    Prng,
    type RandomFunction,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishPlayerState, HydratedFreshFishPlayerState } from '../model/playerState.js'
import { HydratedTileBag, TileBag } from '../components/tileBag.js'

import { GoodsType } from './goodsType.js'

import { MachineState } from './states.js'
import { StallTile, TileType } from '../components/tiles.js'
import { generateBoard } from '../util/boardGenerator.js'
import { FreshFishColors } from './colors.js'
import { FreshFishGameConfig } from './gameConfig.js'

export class FreshFishGameInitializer
    extends BaseGameInitializer<FreshFishGameState, HydratedFreshFishGameState>
    implements GameInitializer<FreshFishGameState, HydratedFreshFishGameState>
{
    initializeExplorationState(state: FreshFishGameState): FreshFishGameState {
        const hydratedState = new HydratedFreshFishGameState(state)
        hydratedState.tileBag.shuffle()
        return hydratedState.dehydrate()
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedFreshFishGameState {
        const prng = new Prng(state.prng)
        const config = game.config as FreshFishGameConfig

        const boardSeed = config.boardSeed ? config.boardSeed : state.prng.seed
        const boardPrng = new Prng({ seed: boardSeed, invocations: 0 })
        const { board, numMarketTiles } = generateBoard(game.players.length, boardPrng.random)

        const players = this.initializePlayers(game, prng.random)
        const turnManager = HydratedTurnManager.generate(players, prng.random)
        const finalStalls = Object.values(GoodsType).map(
            (goodsType) => <StallTile>{ type: TileType.Stall, goodsType }
        )
        shuffle(finalStalls, prng.random)

        const freshFishState: FreshFishGameState = Object.assign(state, {
            players: players,
            turnManager: turnManager,
            machineState: MachineState.StartOfTurn,
            tileBag: this.initializeTileBag(game, numMarketTiles, prng.random),
            board,
            finalStalls: finalStalls,
            boardSeed: boardSeed
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
