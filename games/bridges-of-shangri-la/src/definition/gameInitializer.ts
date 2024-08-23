import {
    GameInitializer,
    generateSeed,
    getPrng,
    RandomFunction,
    BaseGameInitializer
} from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle
} from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { BridgesPlayerState, PlayerColor } from '../model/playerState.js'

import { nanoid } from 'nanoid'
import { MachineState } from './states.js'
import { BridgesGameBoard } from '../components/gameBoard.js'
import { MasterType } from './masterType.js'
import { Village } from '../components/village.js'

export class BridgesGameInitializer extends BaseGameInitializer implements GameInitializer {
    initializeGameState(game: Game, seed?: number): HydratedGameState {
        seed = seed === undefined ? generateSeed() : seed
        const prng = getPrng(seed)

        const players = this.initializePlayers(game, prng)
        const numPlayers = game.players.length
        const turnManager = HydratedSimpleTurnManager.generate(players, prng)

        const board = this.initializeBoard(numPlayers)

        const state = new HydratedBridgesGameState({
            id: nanoid(),
            gameId: game.id,
            seed,
            activePlayerIds: [],
            turnManager: turnManager,
            actionCount: 0,
            actionChecksum: 0,
            players: players,
            machineState: MachineState.StartOfTurn,
            winningPlayerIds: [],
            board,
            stones: numPlayers === 3 ? 11 : 12
        })

        return state
    }

    private initializePlayers(game: Game, prng: RandomFunction): BridgesPlayerState[] {
        const colors = [PlayerColor.Red, PlayerColor.Blue, PlayerColor.Yellow, PlayerColor.Purple]

        shuffle(colors, prng)

        const players = game.players.map((player: Player, index: number) => {
            return {
                playerId: player.id,
                color: colors[index],
                pieces: {
                    [MasterType.Astrologer]: 6,
                    [MasterType.DragonBreeder]: 6,
                    [MasterType.Firekeeper]: 6,
                    [MasterType.Healer]: 6,
                    [MasterType.Priest]: 6,
                    [MasterType.Rainmaker]: 6,
                    [MasterType.YetiWhisperer]: 6
                },
                score: 0
            }
        })

        return players
    }

    private initializeBoard(numPlayers: number): BridgesGameBoard {
        const board: BridgesGameBoard = {
            villages: [
                this.createVillage([1, 3, 4, 6], false),
                this.createVillage(numPlayers === 3 ? [0, 5] : [0, 2, 5], false),
                this.createVillage(numPlayers === 3 ? [] : [1, 5, 9], numPlayers === 3),
                this.createVillage([0, 4, 6, 10], false),
                this.createVillage([0, 3, 5, 7], false),
                this.createVillage(numPlayers === 3 ? [1, 4, 8] : [1, 2, 4, 8], false),
                this.createVillage([0, 3, 10], false),
                this.createVillage([4, 8, 10, 11], false),
                this.createVillage([5, 7, 9, 12], false),
                this.createVillage(numPlayers === 3 ? [8, 12] : [2, 8, 12], false),
                this.createVillage([3, 6, 7, 11], false),
                this.createVillage([7, 10, 12], false),
                this.createVillage([8, 9, 11], false)
            ]
        }
        return board
    }

    private createVillage(neighbors: number[], stone: boolean): Village {
        return {
            spaces: {
                [MasterType.Astrologer]: undefined,
                [MasterType.DragonBreeder]: undefined,
                [MasterType.Firekeeper]: undefined,
                [MasterType.Healer]: undefined,
                [MasterType.Priest]: undefined,
                [MasterType.Rainmaker]: undefined,
                [MasterType.YetiWhisperer]: undefined
            },
            neighbors: neighbors,
            stone: stone
        }
    }
}
