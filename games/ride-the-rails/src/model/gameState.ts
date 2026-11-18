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
import { MapId } from '../data/maps.js'
import { RailroadId } from '../data/railroads.js'
import { CityId } from '../data/boardMap.js'
import { boardMap } from '../data/boardMaps.js'
import { MachineState } from '../definition/states.js'
import { HydratedRideTheRailsPlayerState, RideTheRailsPlayerState } from './playerState.js'

// R-X.3
export const CURRENT_RIDE_THE_RAILS_REVISION = 1

// A track key reads as a hex id of any map; the state's refinement keeps it to the state's map.
// One key pattern for every map, where `HexId` is a union of one per map, lets a track written
// with `HexId` keys take the record's value type.
const TrackHexId = Type.TemplateLiteral([
    Type.Literal('hex.'),
    Type.String(),
    Type.Literal('.'),
    Type.Number(),
    Type.Literal('-'),
    Type.Number()
])

// The railroads with a locomotive in each hex, in placement order (R-3.2, R-4.1).
export type Track = Type.Static<typeof Track>
export const Track = Type.Record(
    TrackHexId,
    Type.Array(RailroadId, { minItems: 1, uniqueItems: true })
)

// R-4.3.3: paid once.
export type TranscontinentalClaim = Type.Static<typeof TranscontinentalClaim>
export const TranscontinentalClaim = Type.Object({
    playerId: Type.String(),
    amount: Type.Integer({ minimum: 1 })
})

// R-8 (Intercolonial, Greater Germany): a map's connection bonus is paid once. Its amount is
// the map's bonus definition's, so the claim keeps only who took it.
export type ConnectionClaim = Type.Static<typeof ConnectionClaim>
export const ConnectionClaim = Type.Object({
    playerId: Type.String()
})

// R-3.2.3, R-3.2.4: what the placement limit consults during one building turn; R-8: a
// long-distance placement ends the turn, and only such a turn holds the mark.
export type BuildingTurn = Type.Static<typeof BuildingTurn>
export const BuildingTurn = Type.Object({
    placed: Type.Integer({ minimum: 0 }),
    usedMountain: Type.Boolean(),
    usedLongDistance: Type.Optional(Type.Literal(true))
})

// R-3.3.6: passengers are identical, so state keeps the cities holding one, in id order.
export function inCityIdOrder(cityIds: readonly CityId[]): CityId[] {
    return [...cityIds].sort()
}

// R-8.1: track lies only in the hexes of the state's map. `Type.Evaluate` drops a record's
// `additionalProperties`, and the key pattern admits hexes the map does not have, so the whole
// state carries this refinement instead.
function tracksOnlyMapHexes(mapId: MapId, track: Readonly<Record<string, unknown>>): boolean {
    const map = boardMap(mapId)
    return Object.keys(track).every((hexId) => map.hasHex(hexId))
}

// R-1.3.2, R-8.1: passengers stand only in cities of the state's map.
function carriesOnlyMapCities(mapId: MapId, passengers: readonly string[]): boolean {
    const map = boardMap(mapId)
    return passengers.every((cityId) => map.hasCity(cityId))
}

export type RideTheRailsGameState = Type.Static<typeof RideTheRailsGameState>
export const RideTheRailsGameState = Type.Refine(
    Type.Refine(
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
                    connectionClaim: Type.Optional(ConnectionClaim),
                    building: Type.Optional(BuildingTurn)
                })
            ])
        ),
        (state) => tracksOnlyMapHexes(state.mapId, state.track),
        'track lies only in hexes of the map'
    ),
    (state) => carriesOnlyMapCities(state.mapId, state.passengers),
    'passengers stand only in cities of the map'
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
    declare connectionClaim?: ConnectionClaim
    declare building?: BuildingTurn

    constructor(data: RideTheRailsGameState) {
        super(data, RideTheRailsGameStateValidator)
        this.players = data.players.map((player) => new HydratedRideTheRailsPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }
}
