import {
    type GameInitializer,
    type RandomFunction,
    BaseGameInitializer,
    Prng,
    Color,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedSimpleTurnManager, shuffle } from '@tabletop/common'
import { EstatesGameState, HydratedEstatesGameState } from '../model/gameState.js'
import { EstatesPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { BoardRow, EstatesGameBoard, Site } from '../components/gameBoard.js'
import { Company } from './companies.js'
import { HydratedRoofBag } from '../components/roofBag.js'
import { Cube } from '../components/cube.js'
import { PieceType } from '../components/pieceType.js'

export class EstatesGameInitializer
    extends BaseGameInitializer<EstatesGameState, HydratedEstatesGameState>
    implements GameInitializer<EstatesGameState, HydratedEstatesGameState>
{
    initializeExplorationState(state: EstatesGameState): EstatesGameState {
        const hydratedState = new HydratedEstatesGameState(state)
        hydratedState.roofs.shuffle()
        return hydratedState.dehydrate()
    }

    initializeGameState(
        game: Game,
        state: UninitializedGameState
    ): HydratedEstatesGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game)
        const turnManager = HydratedSimpleTurnManager.generate(players, prng.random)

        const board = this.initializeBoard()

        const estatesState: EstatesGameState = Object.assign(state, {
            players: players,
            turnManager: turnManager,
            machineState: MachineState.StartOfTurn,
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

        return new HydratedEstatesGameState(estatesState)
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
