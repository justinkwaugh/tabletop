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
            currentLocation: BuildingType,
            currentBuildingPhase: Type.Number(),
            initialBuildingsPlaced: Type.Number(),
            lineExpansionAction: Type.Array(Type.String()), // Slots for line expansion
            busAction: Type.Optional(Type.String()), // Slot for bus action
            passengersAction: Type.Array(Type.String()), // Slots for passenger action
            passengerTurnsTaken: Type.Optional(Type.Number()), // Number of passenger turns taken in the current round
            buildingAction: Type.Array(Type.String()), // Slots for building action
            clockAction: Type.Optional(Type.String()), // Slot for clock action
            vroomAction: Type.Array(Type.String()), // Slots for vroom action
            startingPlayerAction: Type.Optional(Type.String()), // Slot for starting player action
            passedPlayers: Type.Array(Type.String()), // Players who have passed
            roundStartMaxBusValue: Type.Number(), // Max bus value at the start of the round
            actionsTaken: Type.Number() // Number of actions taken
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
    declare currentBuildingPhase: number
    declare initialBuildingsPlaced: number
    declare lineExpansionAction: string[]
    declare busAction?: string
    declare passengersAction: string[]
    declare passengerTurnsTaken?: number
    declare buildingAction: string[]
    declare clockAction?: string
    declare vroomAction: string[]
    declare startingPlayerAction?: string
    declare passedPlayers: string[]
    declare roundStartMaxBusValue: number
    declare actionsTaken: number

    constructor(data: BusGameState) {
        super(data, BusGameStateValidator)

        this.players = data.players.map((player) => new HydratedBusPlayerState(player))
        this.board = new HydratedGameBoard(data.board)
    }

    nextBuildingPhase() {
        if (this.currentBuildingPhase === 4) {
            return
        }
        this.currentBuildingPhase += 1
    }

    numSitesRemainingForCurrentPhase(): number {
        return this.board.openSitesForPhase(this.currentBuildingPhase).length
    }

    maxBusValue() {
        return Math.max(...this.players.map((player) => player.buses))
    }
}
