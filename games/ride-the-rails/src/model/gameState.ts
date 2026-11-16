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
import { CityId, isUsaHex } from '../data/usaMap.js'
import { MachineState } from '../definition/states.js'
import { HydratedRideTheRailsPlayerState, RideTheRailsPlayerState } from './playerState.js'

// R-X.3
export const CURRENT_RIDE_THE_RAILS_REVISION = 1

// The railroads with a locomotive in each hex, in placement order (R-3.2, R-4.1).
export type Track = Type.Static<typeof Track>
export const Track = Type.Record(HexId, Type.Array(RailroadId, { minItems: 1, uniqueItems: true }))

// R-4.3.3: paid once.
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

// R-8.1: track lies only in the map's hexes. `Type.Evaluate` drops a record's
// `additionalProperties`, and the key pattern admits hexes the map does not have, so the whole
// state carries this refinement instead.
function tracksOnlyMapHexes(track: Readonly<Record<string, unknown>>): boolean {
    return Object.keys(track).every((hexId) => isUsaHex(hexId))
}

export type RideTheRailsGameState = Type.Static<typeof RideTheRailsGameState>
export const RideTheRailsGameState = Type.Refine(
    Type.Evaluate(
        Type.Intersect([
            Type.Omit(GameState, ['players', 'machineState']),
            Type.Object({
                players: Type.Array(RideTheRailsPlayerState),
                machineState: Type.Enum(MachineState),
                // R-X.3: a state from a later revision than this code knows is refused.
                rideTheRailsRevision: Type.Integer({
                    minimum: 1,
                    maximum: CURRENT_RIDE_THE_RAILS_REVISION
                }),
                mapId: MapId,
                roundManager: RoundManager,
                phaseManager: PhaseManager,
                track: Track,
                passengers: Type.Array(CityId, { uniqueItems: true }),
                transcontinental: Type.Optional(TranscontinentalClaim),
                building: Type.Optional(BuildingTurn)
            })
        ])
    ),
    (state) => tracksOnlyMapHexes(state.track),
    'track lies only in hexes of the map'
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
    declare transcontinental?: TranscontinentalClaim
    declare building?: BuildingTurn

    constructor(data: RideTheRailsGameState) {
        super(data, RideTheRailsGameStateValidator)
        this.players = data.players.map((player) => new HydratedRideTheRailsPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }
}
