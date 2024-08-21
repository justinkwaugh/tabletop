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
import {
    BridgesPlayerState,
    HydratedBridgesPlayerState,
    PlayerColor
} from '../model/playerState.js'

import { nanoid } from 'nanoid'
import { MachineState } from './states.js'
import { BridgesGameBoard, HydratedGameBoard, Village } from '../components/gameBoard.js'
import { MasterType } from 'src/components/tiles.js'

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
            return new HydratedBridgesPlayerState({
                playerId: player.id,
                color: colors[index],
                numAstrologers: 6,
                numDragonBreeders: 6,
                numFirekeepers: 6,
                numHealers: 6,
                numPriests: 6,
                numRainmakers: 6,
                numYetiWhisperers: 6
            })
        })

        return players
    }

    private initializeBoard(numPlayers: number): HydratedGameBoard {
        const board: BridgesGameBoard = {
            villages: [
                this.createVillage([1, 3, 4, 6], false),
                this.createVillage(numPlayers === 3 ? [0, 5] : [0, 2, 5], false),
                this.createVillage(numPlayers === 3 ? [] : [1, 5, 9], numPlayers === 3),
                this.createVillage([0, 4, 6, 7], false),
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
        return new HydratedGameBoard(board)
    }

    private createVillage(neighbors: number[], stone: boolean): Village {
        return {
            spaces: {
                [MasterType.Astrologer]: { playerId: undefined, count: 0 },
                [MasterType.DragonBreeder]: { playerId: undefined, count: 0 },
                [MasterType.Firekeeper]: { playerId: undefined, count: 0 },
                [MasterType.Healer]: { playerId: undefined, count: 0 },
                [MasterType.Priest]: { playerId: undefined, count: 0 },
                [MasterType.Rainmaker]: { playerId: undefined, count: 0 },
                [MasterType.YetiWhisperer]: { playerId: undefined, count: 0 }
            },
            neighbors: neighbors,
            stone: stone
        }
    }
}
