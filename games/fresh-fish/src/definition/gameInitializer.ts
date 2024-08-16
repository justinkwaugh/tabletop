import { GameInitializer, generateSeed, getPrng, RandomFunction } from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle,
    GameStatus
} from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import {
    FreshFishPlayerState,
    HydratedFreshFishPlayerState,
    PlayerColor
} from '../model/playerState.js'
import { HydratedTileBag, TileBag } from '../components/tileBag.js'

import { nanoid } from 'nanoid'
import { FreshFishGameConfig, FreshFishGameConfigValidator } from './gameConfig.js'
import { GoodsType } from './goodsType.js'

import { MachineState } from './states.js'
import { StallTile, TileType } from '../components/tiles.js'
import { Value } from '@sinclair/typebox/value'
import { generateBoard } from '../util/boardGenerator.js'

export class FreshFishGameInitializer implements GameInitializer {
    initializeGame(game: Partial<Game>): Game {
        game.config =
            game.config ??
            <FreshFishGameConfig>{
                numTurnsWithDisksToStart: 3
            }

        if (!FreshFishGameConfigValidator.Check(game.config)) {
            throw Error(JSON.stringify([...FreshFishGameConfigValidator.Errors(game.config)]))
        }

        const newGame = <Game>{
            id: game.id,
            isPublic: game.isPublic,
            status: GameStatus.WaitingForPlayers,
            typeId: game.typeId,
            deleted: false,
            name: game.name?.trim() || 'Fresh Fish',
            ownerId: game.ownerId,
            players: game.players,
            config: game.config,
            hotseat: false,
            winningPlayerIds: [],
            createdAt: new Date() // This will be updated by the db
        }

        if (!Value.Check(Game, newGame)) {
            throw Error(JSON.stringify([...Value.Errors(Game, newGame)]))
        }

        return newGame
    }

    initializeGameState(game: Game, seed?: number): HydratedGameState {
        seed = seed === undefined ? generateSeed() : seed
        const prng = getPrng(seed)

        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedSimpleTurnManager.generate(players, prng)
        const finalStalls = Object.values(GoodsType).map(
            (goodsType) => <StallTile>{ type: TileType.Stall, goodsType }
        )
        shuffle(finalStalls, prng)

        const { board, numMarketTiles } = generateBoard(game.players.length, prng)

        const state = new HydratedFreshFishGameState({
            id: nanoid(),
            gameId: game.id,
            seed,
            activePlayerIds: [],
            turnManager: turnManager,
            actionCount: 0,
            players: players,
            machineState: MachineState.StartOfTurn,
            winningPlayerIds: [],
            tileBag: this.initializeTileBag(game, numMarketTiles, prng),
            board,
            finalStalls: finalStalls
        })

        state.score()

        return state
    }

    private initializePlayers(game: Game, prng: RandomFunction): FreshFishPlayerState[] {
        const colors = [
            PlayerColor.Red,
            PlayerColor.Blue,
            PlayerColor.Green,
            PlayerColor.Yellow,
            PlayerColor.Purple
        ]

        shuffle(colors, prng)

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

    private initializeTileBag(game: Game, numMarketTiles: number, prng: RandomFunction): TileBag {
        const numBagStalls = game.players.length - 1
        return HydratedTileBag.generate(
            numMarketTiles,
            numBagStalls,
            numBagStalls,
            numBagStalls,
            numBagStalls,
            prng
        )
    }
}
