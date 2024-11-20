import {
    GameInitializer,
    generateSeed,
    RandomFunction,
    BaseGameInitializer,
    PrngState,
    Prng,
    PlayerState
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
import { SolGameConfigValidator } from './gameConfig.js'
import { Sundiver } from '../components/sundiver.js'
import { SolarGate } from '../components/solarGate.js'
import { EnergyNode, StationType, SundiverFoundry, TransmitTower } from '../components/stations.js'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { Suit } from '../components/cards.js'
import { Deck } from '../components/deck.js'
import { Effect, Effects } from '../components/effects.js'

const MOTHERSHIP_SPACING = [0, 6, 4, 3, 3]

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
        const nonFlareSuits = [
            Suit.Condensation,
            Suit.Expansion,
            Suit.Oscillation,
            Suit.Refraction,
            Suit.Reverberation,
            Suit.Subduction
        ]
        shuffle(nonFlareSuits, prng.random)
        const suits = [Suit.Flare, ...nonFlareSuits.slice(0, players.length + 1)]
        const deck = Deck.create(suits, prng.random)

        const allEffects = structuredClone(Effects)
        shuffle(allEffects, prng.random)
        const effects: Record<string, Effect> = {}

        suits.forEach((suit, index) => {
            effects[suit] = allEffects[index]
        })

        // const config = game.config as SolGameConfig
        const board = this.initializeBoard(players, prng.random)

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
            board,
            deck,
            effects,
            instability: 13,
            energyCubes: 89
        })

        return state
    }

    private initializePlayers(game: Game, random: RandomFunction): SolPlayerState[] {
        const colors = structuredClone(SolColors)

        shuffle(colors, random)

        const players = game.players.map((player: Player, index: number) => {
            const holdSundivers: Sundiver[] = []
            for (let i = 0; i < 8; i++) {
                holdSundivers.push({
                    id: nanoid(),
                    playerId: player.id
                })
            }

            const reserveSundivers: Sundiver[] = []
            for (let i = 0; i < 5; i++) {
                reserveSundivers.push({
                    id: nanoid(),
                    playerId: player.id
                })
            }

            const solarGates: SolarGate[] = []
            for (let i = 0; i < 5; i++) {
                solarGates.push({
                    id: nanoid(),
                    playerId: player.id
                })
            }

            const energyNodes: EnergyNode[] = []
            for (let i = 0; i < 3; i++) {
                energyNodes.push({
                    type: StationType.EnergyNode,
                    id: nanoid(),
                    playerId: player.id
                })
            }

            const sundiverFoundries: SundiverFoundry[] = []
            for (let i = 0; i < 3; i++) {
                sundiverFoundries.push({
                    type: StationType.SundiverFoundry,
                    id: nanoid(),
                    playerId: player.id
                })
            }

            const transmitTowers: TransmitTower[] = []
            for (let i = 0; i < 3; i++) {
                transmitTowers.push({
                    type: StationType.TransmitTower,
                    id: nanoid(),
                    playerId: player.id
                })
            }

            return new HydratedSolPlayerState({
                playerId: player.id,
                color: colors[index],
                score: 0,
                holdSundivers,
                reserveSundivers,
                energyCubes: 3,
                solarGates,
                energyNodes,
                sundiverFoundries,
                transmitTowers,
                movement: 3
            })
        })

        return players
    }

    private initializeBoard(players: PlayerState[], random: RandomFunction): HydratedSolGameBoard {
        const numPlayers = players.length
        const numMothershipPositions = numPlayers === 5 ? 16 : 13
        const spacing = MOTHERSHIP_SPACING[numPlayers]
        const motherships: Record<string, number> = {}

        const randomOffset = Math.floor(random() * numMothershipPositions)
        for (let i = 0; i < players.length; i++) {
            motherships[players[i].playerId] = (randomOffset + i * spacing) % numMothershipPositions
        }

        const board = new HydratedSolGameBoard({
            numPlayers,
            motherships,
            cells: {},
            gates: {}
        })

        return board
    }
}
