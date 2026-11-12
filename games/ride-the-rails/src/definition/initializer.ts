import {
    BaseGameInitializer,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type Player,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    CURRENT_RIDE_THE_RAILS_REVISION,
    HydratedRideTheRailsGameState,
    type RideTheRailsGameState
} from '../model/gameState.js'
import {
    HydratedRideTheRailsPlayerState,
    type RideTheRailsPlayerState
} from '../model/playerState.js'
import { RideTheRailsColors } from './colors.js'
import { MachineState } from './states.js'

export class RideTheRailsGameInitializer
    extends BaseGameInitializer<RideTheRailsGameState, HydratedRideTheRailsGameState>
    implements GameInitializer<RideTheRailsGameState, HydratedRideTheRailsGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedRideTheRailsGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const orderedPlayers = turnManager.turnOrder
            .map((playerId) => players.find((player) => player.playerId === playerId))
            .filter((player): player is RideTheRailsPlayerState => player !== undefined)

        const rideTheRailsGameState: RideTheRailsGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.StartOfTurn,
            turnManager,
            rideTheRailsRevision: CURRENT_RIDE_THE_RAILS_REVISION
        })

        return new HydratedRideTheRailsGameState(rideTheRailsGameState)
    }

    private initializePlayers(game: Game, prng: Prng): RideTheRailsPlayerState[] {
        const colors = [...RideTheRailsColors]
        shuffle(colors, prng.random)

        return game.players.map(
            (player: Player, index: number) =>
                new HydratedRideTheRailsPlayerState({
                    playerId: player.id,
                    color: colors[index]
                })
        )
    }
}
