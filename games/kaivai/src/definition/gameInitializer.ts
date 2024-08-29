import {
    GameInitializer,
    generateSeed,
    getPrng,
    RandomFunction,
    BaseGameInitializer,
    range
} from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle
} from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { KaivaiPlayerState } from '../model/playerState.js'

import { nanoid } from 'nanoid'
import { MachineState } from './states.js'
import { KaivaiGameBoard } from '../components/gameBoard.js'
import { KaivaiPlayerColors } from './colors.js'
import { PlayerAction } from './playerActions.js'

export class KaivaiGameInitializer extends BaseGameInitializer implements GameInitializer {
    initializeGameState(game: Game, seed?: number): HydratedGameState {
        seed = seed === undefined ? generateSeed() : seed
        const prng = getPrng(seed)

        const players = this.initializePlayers(game, prng)
        const numPlayers = game.players.length
        const turnManager = HydratedSimpleTurnManager.generate(players, prng)

        const board = this.initializeBoard(numPlayers)

        const state = new HydratedKaivaiGameState({
            id: nanoid(),
            gameId: game.id,
            seed,
            activePlayerIds: [],
            turnManager: turnManager,
            actionCount: 0,
            actionChecksum: 0,
            players: players,
            machineState: MachineState.EndOfGame,
            winningPlayerIds: [],
            board,
            influence: {
                [PlayerAction.Build]: 0,
                [PlayerAction.Fish]: 0,
                [PlayerAction.Deliver]: 0,
                [PlayerAction.Celebrate]: 0,
                [PlayerAction.Move]: 0,
                [PlayerAction.Increase]: 0
            },
            cultTiles: 12
        })

        return state
    }

    private initializePlayers(game: Game, prng: RandomFunction): KaivaiPlayerState[] {
        const colors = structuredClone(KaivaiPlayerColors)

        shuffle(colors, prng)

        const players = game.players.map((player: Player, index: number) => {
            return {
                playerId: player.id,
                color: colors[index],
                boats: range(1, 6).map((index) => {
                    return {
                        id: String(index),
                        owner: player.id
                    }
                }),
                movementModiferPosition: 0,
                shells: [0, 0, 0, 0, 3], // 3 five-value shells
                fish: [0, 0, 0, 3, 0], // 3 four-value fish
                score: 0
            }
        })

        return players
    }

    private initializeBoard(_numPlayers: number): KaivaiGameBoard {
        const board: KaivaiGameBoard = {}
        return board
    }
}
