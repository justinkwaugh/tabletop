import {
    GameInitializer,
    generateSeed,
    RandomFunction,
    BaseGameInitializer,
    PrngState,
    Prng,
    Color
} from '@tabletop/common'
import {
    Game,
    Player,
    type HydratedGameState,
    HydratedSimpleTurnManager,
    shuffle
} from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { EstatesPlayerState } from '../model/playerState.js'

import { nanoid } from 'nanoid'
import { MachineState } from './states.js'
import { BoardRow, EstatesGameBoard, Site } from '../components/gameBoard.js'
import { Company } from './companies.js'
import { HydratedRoofBag } from '../components/roofBag.js'
import { Cube } from '../components/cube.js'
import { PieceType } from '../components/pieceType.js'
// import { BridgesPlayerColors } from './colors.js'

export class EstatesGameInitializer extends BaseGameInitializer implements GameInitializer {
    initializeGameState(game: Game, seed?: number): HydratedGameState {
        seed = seed === undefined ? generateSeed() : seed
        const prngState: PrngState = { seed, invocations: 0 }
        const prng = new Prng(prngState)
        const players = this.initializePlayers(game)
        const turnManager = HydratedSimpleTurnManager.generate(players, prng.random)

        const board = this.initializeBoard()

        const state = new HydratedEstatesGameState({
            id: nanoid(),
            gameId: game.id,
            prng: prngState,
            activePlayerIds: [],
            turnManager: turnManager,
            actionCount: 0,
            actionChecksum: 0,
            players: players,
            machineState: MachineState.StartOfTurn,
            winningPlayerIds: [],
            board,
            certificates: [
                Company.Skyline,
                Company.Collar,
                Company.Emerald,
                Company.Golden,
                Company.Heather,
                Company.Sienna
            ],
            cubes: this.intializeCubes(prng.random),
            roofs: HydratedRoofBag.create(prng.random),
            visibleRoofs: new Array(12).fill(true),
            mayor: true,
            barrierOne: true,
            barrierTwo: true,
            barrierThree: true,
            cancelCube: true,
            chosenPiece: undefined,
            auction: undefined
        })

        return state
    }

    private initializePlayers(game: Game): EstatesPlayerState[] {
        const players: EstatesPlayerState[] = game.players.map((player: Player) => {
            return {
                playerId: player.id,
                color: Color.White,
                certificates: [],
                money: 12,
                stolen: 0,
                score: 0
            }
        })

        return players
    }

    private initializeBoard(): EstatesGameBoard {
        const site: Site = {
            single: false,
            cubes: [],
            roof: undefined,
            barriers: []
        }

        const rowOne: BoardRow = {
            mayor: false,
            sites: [],
            length: 4
        }
        for (let i = 0; i < 10; i++) {
            rowOne.sites.push(structuredClone(site))
            if (i === 1) {
                rowOne.sites[i].single = true
            }
        }

        const rowTwo: BoardRow = {
            mayor: false,
            sites: [],
            length: 4
        }

        for (let i = 0; i < 10; i++) {
            rowTwo.sites.push(structuredClone(site))
            if (i === 2 || i === 4) {
                rowTwo.sites[i].single = true
            }
        }

        const rowThree: BoardRow = {
            mayor: false,
            sites: [],
            length: 4
        }

        for (let i = 0; i < 10; i++) {
            rowThree.sites.push(structuredClone(site))
            if (i === 0 || i === 6) {
                rowThree.sites[i].single = true
            }
        }

        const board: EstatesGameBoard = {
            rows: [rowOne, rowTwo, rowThree]
        }
        return board
    }

    private intializeCubes(random: RandomFunction): Cube[][] {
        const allCubes: Cube[] = []
        for (let i = 1; i < 7; i++) {
            for (const value of Object.values(Company)) {
                allCubes.push({
                    pieceType: PieceType.Cube,
                    company: value,
                    value: i
                })
            }
        }

        shuffle(allCubes, random)

        const rowOne = allCubes.splice(0, 8)
        const rowTwo = allCubes.splice(0, 8)
        const rowThree = allCubes.splice(0, 8)
        return [rowOne, rowTwo, rowThree]
    }
}
