import {
    GameInitializer,
    generateSeed,
    RandomFunction,
    BaseGameInitializer,
    PrngState,
    Prng
} from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedSolPlayerState, SolPlayerState } from '../model/playerState.js'

import { nanoid } from 'nanoid'
import { MachineState } from './states.js'
import { SolColors } from './colors.js'
import { SolGameConfig, SolGameConfigValidator } from './gameConfig.js'

export class SolGameInitializer extends BaseGameInitializer implements GameInitializer {
    override initializeGame(game: Partial<Game>): Game {
        const config = game.config
        if (!SolGameConfigValidator.Check(config)) {
            throw Error(JSON.stringify([...SolGameConfigValidator.Errors(config)]))
        }
        return super.initializeGame(game)
    }

    initializeGameState(game: Game, seed?: number): HydratedGameState {
        seed = seed === undefined ? generateSeed() : seed
        const prngState: PrngState = { seed, invocations: 0 }
        const prng = new Prng(prngState)
        const players = this.initializePlayers(game, prng.random)
        // const numPlayers = game.players.length
        // const config = game.config as SolGameConfig
        // const board = this.initializeBoard(numPlayers, config.ruleset, prng.random)

        const state = new HydratedSolGameState({
            id: nanoid(),
            gameId: game.id,
            prng: prngState,
            activePlayerIds: [],
            turnManager: HydratedSimpleTurnManager.generate(players, prng.random),
            actionCount: 0,
            actionChecksum: 0,
            players: players,
            machineState: MachineState.EndOfGame,
            winningPlayerIds: [],
            instability: 13,
            energyCubes: 89
        })

        return state
    }

    private initializePlayers(game: Game, random: RandomFunction): SolPlayerState[] {
        const colors = structuredClone(SolColors)

        shuffle(colors, random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedSolPlayerState({
                playerId: player.id,
                color: colors[index],
                score: 0,
                holdSundivers: 8,
                reserveSundivers: 5,
                energyCubes: 3,
                solarGates: 5,
                energyNodes: 3,
                sundiverFoundries: 3,
                transmitTowers: 3,
                movement: 3
            })
        })

        return players
    }
}
