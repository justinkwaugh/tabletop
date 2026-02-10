import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { BusPlayerState, HydratedBusPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { GameBoard, HydratedGameBoard } from '../components/board.js'
import { Passenger } from '../components/passenger.js'
import { BuildingType } from '../components/building.js'

export type BusGameState = Type.Static<typeof BusGameState>
export const BusGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(BusPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            board: GameBoard,
            passengers: Type.Array(Passenger), // Supply
            currentLocation: BuildingType
        })
    ])
)

const BusGameStateValidator = Compile(BusGameState)

export class HydratedBusGameState
    extends HydratableGameState<typeof BusGameState, HydratedBusPlayerState>
    implements BusGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedBusPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedGameBoard
    declare passengers: Passenger[]
    declare currentLocation: BuildingType

    constructor(data: BusGameState) {
        super(data, BusGameStateValidator)

        this.players = data.players.map((player) => new HydratedBusPlayerState(player))
        this.board = new HydratedGameBoard(data.board)
    }
}
