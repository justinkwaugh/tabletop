import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    PhaseManager,
    PrngState,
    RoundManager
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { HexId } from '../data/hexes.js'
import { MapId } from '../data/maps.js'
import { RailroadId } from '../data/railroads.js'
import { CityId } from '../data/usaMap.js'
import { MachineState } from '../definition/states.js'
import { HydratedRideTheRailsPlayerState, RideTheRailsPlayerState } from './playerState.js'

// R-X.3
export const CURRENT_RIDE_THE_RAILS_REVISION = 1

// The railroads with a locomotive in each hex, in placement order (R-3.2, R-4.1).
export type Track = Type.Static<typeof Track>
export const Track = Type.Record(HexId, Type.Array(RailroadId, { minItems: 1, uniqueItems: true }))

// R-4.2.3, R-4.2.3-H1, R-4.2.3-H2: Yellow's two starts cannot be read from track. The
// westernmost set is empty when no city held a locomotive at Yellow's first placement.
export type YellowState = Type.Static<typeof YellowState>
export const YellowState = Type.Object({
    westernmost: Type.Optional(Type.Array(CityId, { uniqueItems: true })),
    startedInChicago: Type.Boolean(),
    westStartCityId: Type.Optional(CityId)
})

// R-4.3.3, R-4.3.3-H2: paid once.
export type TranscontinentalClaim = Type.Static<typeof TranscontinentalClaim>
export const TranscontinentalClaim = Type.Object({
    playerId: Type.String(),
    amount: Type.Integer({ minimum: 1 })
})

// R-3.2.3, R-3.2.4: what the placement limit consults during one building turn.
export type BuildingTurn = Type.Static<typeof BuildingTurn>
export const BuildingTurn = Type.Object({
    placed: Type.Integer({ minimum: 0 }),
    usedMountain: Type.Boolean()
})

// R-3.3.6: passengers are identical, so state keeps the cities holding one, in id order.
export function inCityIdOrder(cityIds: readonly CityId[]): CityId[] {
    return [...cityIds].sort()
}

export type RideTheRailsGameState = Type.Static<typeof RideTheRailsGameState>
export const RideTheRailsGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(RideTheRailsPlayerState),
            machineState: Type.Enum(MachineState),
            rideTheRailsRevision: Type.Integer({ minimum: 1 }),
            mapId: MapId,
            roundManager: RoundManager,
            phaseManager: PhaseManager,
            track: Track,
            passengers: Type.Array(CityId, { uniqueItems: true }),
            yellow: YellowState,
            transcontinental: Type.Optional(TranscontinentalClaim),
            building: Type.Optional(BuildingTurn)
        })
    ])
)

export const RideTheRailsGameStateValidator = Compile(RideTheRailsGameState)

export class HydratedRideTheRailsGameState
    extends HydratableGameState<typeof RideTheRailsGameState, HydratedRideTheRailsPlayerState>
    implements RideTheRailsGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedRideTheRailsPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare rideTheRailsRevision: number
    declare mapId: MapId
    declare roundManager: HydratedRoundManager
    declare phaseManager: HydratedPhaseManager
    declare track: Track
    declare passengers: CityId[]
    declare yellow: YellowState
    declare transcontinental?: TranscontinentalClaim
    declare building?: BuildingTurn

    constructor(data: RideTheRailsGameState) {
        super(data, RideTheRailsGameStateValidator)
        this.players = data.players.map((player) => new HydratedRideTheRailsPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }
}
