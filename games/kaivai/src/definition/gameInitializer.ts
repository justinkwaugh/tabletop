import {
    GameInitializer,
    BaseGameInitializer,
    range,
    AxialCoordinates,
    coordinatesToNumber,
    pickRandom,
    HydratedRoundManager,
    HydratedPhaseManager,
    Prng,
    UninitializedGameState
} from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle
} from '@tabletop/common'
import { HydratedKaivaiGameState, KaivaiGameState } from '../model/gameState.js'
import { KaivaiPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { KaivaiGameBoard } from '../components/gameBoard.js'
import { KaivaiColors } from './colors.js'
import { Cell, CellType, CultCell } from './cells.js'
import { defineHex, Grid, Hex, ring, spiral } from 'honeycomb-grid'
import { Island } from '../components/island.js'
import { KaivaiGameConfig, KaivaiGameConfigValidator, Ruleset } from './gameConfig.js'

export class KaivaiGameInitializer extends BaseGameInitializer implements GameInitializer {
    override initializeGame(game: Partial<Game>): Game {
        const config = game.config
        if (!KaivaiGameConfigValidator.Check(config)) {
            throw Error(JSON.stringify([...KaivaiGameConfigValidator.Errors(config)]))
        }
        return super.initializeGame(game)
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const numPlayers = game.players.length
        const config = game.config as KaivaiGameConfig
        const board = this.initializeBoard(numPlayers, config.ruleset, prng)

        const kaivaiState: KaivaiGameState = Object.assign(state, {
            players: players,
            machineState: MachineState.Bidding,
            turnManager: HydratedSimpleTurnManager.generate(players, prng.random),
            rounds: HydratedRoundManager.generate(),
            phases: HydratedPhaseManager.generate(),
            board,
            influence: {},
            bidders: [],
            bids: {},
            cultTiles: game.config.ruleset === Ruleset.FirstEdition ? 10 : 8,
            passedPlayers: [],
            hutsScored: false,
            islandsToScore: [],
            chosenIsland: undefined
        })

        return new HydratedKaivaiGameState(kaivaiState)
    }

    private initializePlayers(game: Game, prng: Prng): KaivaiPlayerState[] {
        const colors = structuredClone(KaivaiColors)

        shuffle(colors, prng.random)

        const config = game.config as KaivaiGameConfig

        const players = game.players.map((player: Player, index: number) => {
            return {
                playerId: player.id,
                color: colors[index],
                boats: range(1, 4).map(() => {
                    return {
                        id: prng.randId(),
                        owner: player.id
                    }
                }),
                availableBoats: [],
                boatLocations: {},
                fishermen: 5,
                movementModiferPosition: 0,
                shells: [0, 0, 0, 0, 3], // 3 five-value shells
                fish: config.ruleset === Ruleset.FirstEdition ? [0, 0, 0, 0, 3] : [0, 0, 0, 3, 0],
                influence: 3,
                score: 0,
                buildingCost: 0,
                baseMovement: 0,
                initialHutsPlaced: 0,
                tiles: 15
            }
        })

        return players
    }

    private initializeBoard(numPlayers: number, ruleset: Ruleset, prng: Prng): KaivaiGameBoard {
        const cells: Record<number, Cell> = {}
        const islands: Record<string, Island> = {}
        const initialCoords: AxialCoordinates[] = [
            { q: -5, r: 0 },
            { q: -1, r: -2 },
            { q: 4, r: -5 },
            { q: -2, r: 2 },
            { q: 2, r: 0 },
            { q: -1, r: 5 }
        ]

        // Mark initial islands
        for (const coords of initialCoords) {
            const islandId = prng.randId()
            islands[islandId] = { id: islandId, coordList: [coords] }
        }

        // Create additional two islands
        const DefaultHex = defineHex()
        const spiralTraverser = spiral({ radius: 6 })
        const hexGrid = new Grid(DefaultHex, spiralTraverser)

        const singleIsland = ruleset === Ruleset.FirstEdition

        const island = this.createAdditionalIsland(hexGrid, initialCoords, singleIsland, prng)
        initialCoords.push(...island.coordList)
        islands[island.id] = island

        if (ruleset !== Ruleset.FirstEdition || numPlayers === 4) {
            const island2 = this.createAdditionalIsland(hexGrid, initialCoords, singleIsland, prng)
            initialCoords.push(...island2.coordList)
            islands[island2.id] = island2
        }

        for (const island of Object.values(islands)) {
            for (const coords of island.coordList) {
                const cell: CultCell = {
                    type: CellType.Cult,
                    coords,
                    islandId: island.id
                }
                cells[coordinatesToNumber(coords)] = cell
            }
        }

        const board: KaivaiGameBoard = {
            cells: cells,
            islands: islands
        }
        return board
    }

    private createAdditionalIsland<T extends Hex>(
        grid: Grid<T>,
        initialCoords: AxialCoordinates[],
        singleIsland: boolean,
        prng: Prng
    ): Island {
        const ringTraverser = ring<T>({ center: [0, 0], radius: 6 })

        let tileOneCoords: AxialCoordinates | undefined
        const validPositions: AxialCoordinates[][] = []

        for (const hex of grid.traverse(ringTraverser)) {
            const hexCoords = { q: hex.q, r: hex.r }

            // Check distance from all initial coords
            if (initialCoords.some((coords) => grid.distance(hex, coords) <= 3)) {
                tileOneCoords = undefined
                continue
            }

            if (singleIsland) {
                validPositions.push([hexCoords])
                continue
            }

            if (!tileOneCoords) {
                tileOneCoords = hexCoords
            } else {
                validPositions.push([tileOneCoords, hexCoords])
                tileOneCoords = hexCoords
            }
        }

        return { id: prng.randId(), coordList: pickRandom(validPositions, prng.random) }
    }
}
