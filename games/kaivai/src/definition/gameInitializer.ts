import {
    GameInitializer,
    generateSeed,
    getPrng,
    RandomFunction,
    BaseGameInitializer,
    range,
    AxialCoordinates,
    axialCoordinatesToNumber,
    pickRandom,
    HydratedRoundManager,
    HydratedPhaseManager
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
import { Cell, CellType, CultCell } from './cells.js'
import { defineHex, Grid, Hex, ring, spiral } from 'honeycomb-grid'
import { Island } from '../components/island.js'

export class KaivaiGameInitializer extends BaseGameInitializer implements GameInitializer {
    initializeGameState(game: Game, seed?: number): HydratedGameState {
        seed = seed === undefined ? generateSeed() : seed
        const prng = getPrng(seed)

        const players = this.initializePlayers(game, prng)
        const numPlayers = game.players.length
        const board = this.initializeBoard(numPlayers, prng)

        const state = new HydratedKaivaiGameState({
            id: nanoid(),
            gameId: game.id,
            seed,
            activePlayerIds: [],
            turnManager: HydratedSimpleTurnManager.generate(players, prng),
            rounds: HydratedRoundManager.generate(),
            phases: HydratedPhaseManager.generate(),
            actionCount: 0,
            actionChecksum: 0,
            players: players,
            machineState: MachineState.Bidding,
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
            bids: {},
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
                fishermen: 6,
                movementModiferPosition: 0,
                shells: [0, 0, 0, 0, 3], // 3 five-value shells
                fish: [0, 0, 0, 3, 0], // 3 four-value fish
                score: 0,
                buildingCost: 0,
                baseMovement: 0
            }
        })

        return players
    }

    private initializeBoard(_numPlayers: number, prng: RandomFunction): KaivaiGameBoard {
        const cells: Record<number, Cell> = {}
        const islands: Island[] = []
        const initialCoords: AxialCoordinates[] = [
            { q: -4, r: -1 },
            { q: 0, r: -2 },
            { q: -2, r: 2 },
            { q: 5, r: -5 },
            { q: 3, r: -1 },
            { q: 1, r: 4 }
        ]

        // Mark initial islands
        for (const coords of initialCoords) {
            islands.push({ id: nanoid(), coordList: [coords] })
        }

        // Create additional two islands
        const DefaultHex = defineHex()
        const spiralTraverser = spiral({ radius: 6 })
        const hexGrid = new Grid(DefaultHex, spiralTraverser)

        const island = this.createAdditionalIsland(hexGrid, initialCoords, prng)
        initialCoords.push(...island.coordList)
        islands.push(island)

        const island2 = this.createAdditionalIsland(hexGrid, initialCoords, prng)
        initialCoords.push(...island2.coordList)
        islands.push(island2)

        for (const island of islands) {
            for (const coords of island.coordList) {
                const cell: CultCell = {
                    type: CellType.Cult,
                    coords,
                    islandId: island.id
                }
                cells[axialCoordinatesToNumber(coords)] = cell
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
        prng: RandomFunction
    ): Island {
        const ringTraverser = ring<T>({ center: [0, 0], radius: 6 })

        let tileOneCoords: AxialCoordinates | undefined
        const validPositions: [AxialCoordinates, AxialCoordinates][] = []

        for (const hex of grid.traverse(ringTraverser)) {
            const hexCoords = { q: hex.q, r: hex.r }

            // Check distance from all initial coords
            if (initialCoords.some((coords) => grid.distance(hex, coords) <= 3)) {
                tileOneCoords = undefined
                continue
            }

            if (!tileOneCoords) {
                tileOneCoords = hexCoords
            } else {
                validPositions.push([tileOneCoords, hexCoords])
                tileOneCoords = hexCoords
            }
        }

        return { id: nanoid(), coordList: pickRandom(validPositions, prng) }
    }
}
