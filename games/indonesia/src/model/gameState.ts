import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedOnceAroundAuction,
    HydratedPhaseManager,
    HydratedTurnManager,
    OnceAroundAuction,
    PhaseManager,
    PrngState
} from '@tabletop/common'
import { IndonesiaPlayerState, HydratedIndonesiaPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { IndonesiaBoard, HydratedIndonesiaBoard } from '../components/board.js'
import { AnyDeed } from '../components/deed.js'
import { Era } from '../definition/eras.js'
import { CityCard } from '../components/cards.js'

export type TurnOrderBid = Type.Static<typeof TurnOrderBid>
export const TurnOrderBid = Type.Object({
    bid: Type.Number(),
    multiplier: Type.Number(),
    total: Type.Number()
})

export type IndonesiaGameState = Type.Static<typeof IndonesiaGameState>
export const IndonesiaGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(IndonesiaPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            phaseManager: PhaseManager,
            board: IndonesiaBoard,
            availableDeeds: Type.Array(AnyDeed),
            availableCities: Type.Object({
                size1: Type.Number(),
                size2: Type.Number(),
                size3: Type.Number()
            }),
            turnOrderBids: Type.Optional(Type.Record(Type.String(), TurnOrderBid)), // Map of playerId to their turn order bid
            era: Type.Enum(Era),
            currentCityCard: Type.Optional(CityCard), // The city card currently being placed in the New Era phase
            placingCities: Type.Array(Type.String()) // List of players remaining to place cities
        })
    ])
)

const IndonesiaGameStateValidator = Compile(IndonesiaGameState)

export class HydratedIndonesiaGameState
    extends HydratableGameState<typeof IndonesiaGameState, HydratedIndonesiaPlayerState>
    implements IndonesiaGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedIndonesiaPlayerState[]
    declare turnManager: HydratedTurnManager
    declare phaseManager: HydratedPhaseManager
    declare machineState: MachineState
    declare board: HydratedIndonesiaBoard
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare availableDeeds: AnyDeed[]
    declare availableCities: {
        size1: number
        size2: number
        size3: number
    }
    declare turnOrderBids?: Record<string, TurnOrderBid>
    declare era: Era
    declare currentCityCard: CityCard | undefined
    declare placingCities: string[]

    constructor(data: IndonesiaGameState) {
        super(data, IndonesiaGameStateValidator)

        this.players = data.players.map((player) => new HydratedIndonesiaPlayerState(player))
        this.board = new HydratedIndonesiaBoard(data.board)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }
}
