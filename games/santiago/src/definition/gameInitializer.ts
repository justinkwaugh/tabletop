import {
    BaseGameInitializer,
    type GameInitializer,
    Prng,
    type RandomFunction,
    type UninitializedGameState,
    shuffle
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager } from '@tabletop/common'
import { SantiagoGameState, HydratedSantiagoGameState } from '../model/gameState.js'
import { HydratedSantiagoPlayerState } from '../model/playerState.js'
import { SantiagoBoard, CropType, PlantingTile, SquareType, EmptySquare } from '../model/board.js'
import { MachineState } from './states.js'
import { SantiagoColors } from './colors.js'
import { SantiagoGameConfig } from './gameConfig.js'

function buildTileBag(): PlantingTile[] {
    const bag: PlantingTile[] = []
    for (const crop of Object.values(CropType)) {
        for (let i = 0; i < 3; i++) bag.push({ crop, farmerCapacity: 1 })
        for (let i = 0; i < 6; i++) bag.push({ crop, farmerCapacity: 2 })
    }
    return bag
}

function buildBoard(
    springCol: number,
    springRow: number,
    palmTrees: boolean,
    random: RandomFunction
): SantiagoBoard {
    const squares: EmptySquare[][] = Array.from({ length: 8 }, () =>
        Array.from({ length: 6 }, (): EmptySquare => ({ type: SquareType.Empty, hasPalmTree: false }))
    )

    if (palmTrees) {
        // Pick 3 distinct squares at random and mark them as palm tree locations.
        // Palm trees coexist with any field placed on that square later.
        const allSquares: [number, number][] = []
        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 6; row++) {
                allSquares.push([col, row])
            }
        }
        shuffle(allSquares, random)
        for (let i = 0; i < 3; i++) {
            const [col, row] = allSquares[i]
            squares[col][row].hasPalmTree = true
        }
    }

    return {
        squares,
        spring: { col: springCol, row: springRow },
        canals: []
    }
}

export class SantiagoGameInitializer
    extends BaseGameInitializer<SantiagoGameState, HydratedSantiagoGameState>
    implements GameInitializer<SantiagoGameState, HydratedSantiagoGameState>
{
    initializeExplorationState(state: SantiagoGameState): SantiagoGameState {
        const hydratedState = new HydratedSantiagoGameState(state)
        shuffle(hydratedState.tileBag, () => Math.random())
        return hydratedState.dehydrate()
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedSantiagoGameState {
        const prng = new Prng(state.prng)
        const config = (game.config ?? {}) as SantiagoGameConfig

        const springCol = config.springCol ?? 2
        const springRow = config.springRow ?? 1

        const tileBag = buildTileBag()
        shuffle(tileBag, prng.random)

        const colors = structuredClone(SantiagoColors)
        shuffle(colors, prng.random)

        const players: HydratedSantiagoPlayerState[] = game.players.map(
            (player: Player, index: number) =>
                new HydratedSantiagoPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    money: 10,
                    score: 0,
                    hasPersonalCanal: true
                })
        )

        const turnManager = HydratedTurnManager.generate(players, prng.random)

        const usePalmTrees = config.palmTrees !== false

        // Choose a random initial canal overseer. Bidding in round 1 starts
        // with the player to their left, same as every subsequent round.
        const initialOverseerIndex = Math.floor(prng.random() * players.length)
        const initialOverseer = players[initialOverseerIndex]

        // Stable display order: initial overseer at top, then clockwise.
        const turnOrder = turnManager.turnOrder
        const overseerPos = turnOrder.indexOf(initialOverseer.playerId)
        const seatOrder = [
            ...turnOrder.slice(overseerPos),
            ...turnOrder.slice(0, overseerPos)
        ]

        const santiagoState: SantiagoGameState = Object.assign(state, {
            players,
            turnManager,
            machineState: MachineState.Bidding,
            board: buildBoard(springCol, springRow, usePalmTrees, prng.random),
            tileBag,
            round: 0,
            plantersOrder: [],
            planterIndex: 0,
            extraIrrigationPassed: [],
            extraIrrigationOrder: [],
            extraIrrigationIndex: 0,
            overseerBidZero: false,
            canalOverseerId: initialOverseer.playerId,
            biddingOrder: [],
            currentBidderIndex: 0,
            revealedTiles: [],
            canalProposals: [],
            canalProposalOrder: [],
            canalProposalIndex: -1,
            seatOrder
        })

        return new HydratedSantiagoGameState(santiagoState)
    }
}
