import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { RideTheRailsPlayerState, HydratedRideTheRailsPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'

export const CURRENT_RIDE_THE_RAILS_REVISION = 1

export type RideTheRailsGameState = Type.Static<typeof RideTheRailsGameState>
export const RideTheRailsGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(RideTheRailsPlayerState),
            machineState: Type.Enum(MachineState),
            rideTheRailsRevision: Type.Number()
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
    declare rideTheRailsRevision: number
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: RideTheRailsGameState) {
        super(data, RideTheRailsGameStateValidator)

        this.players = data.players.map((player) => new HydratedRideTheRailsPlayerState(player))
    }
}
