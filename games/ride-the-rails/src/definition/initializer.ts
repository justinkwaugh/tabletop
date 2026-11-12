import {
    BaseGameInitializer,
    HydratedPhaseManager,
    HydratedRoundManager,
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
    inCityIdOrder,
    type RideTheRailsGameState
} from '../model/gameState.js'
import {
    HydratedRideTheRailsPlayerState,
    type RideTheRailsPlayerState
} from '../model/playerState.js'
import { USA_CITIES } from '../data/usaMap.js'
import { PhaseName } from './phases.js'
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

        // R-1.3: round 1 opens with Take a Share (R-2.1).
        const roundManager = HydratedRoundManager.generate()
        roundManager.startRound(state.actionCount)
        const phaseManager = HydratedPhaseManager.generate()
        phaseManager.startPhase(PhaseName.TakeShare, state.actionCount)

        const rideTheRailsGameState: RideTheRailsGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.TakingShares,
            turnManager,
            rideTheRailsRevision: CURRENT_RIDE_THE_RAILS_REVISION,
            mapId: 'map.usa' as const,
            roundManager,
            phaseManager,
            track: {},
            // R-1.3.2, R-1.3-H1: a passenger on every city, kept in id order.
            passengers: inCityIdOrder(USA_CITIES.map((city) => city.id)),
            yellow: { startedInChicago: false }
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
                    color: colors[index],
                    // R-1.3.6
                    money: 0,
                    shares: {}
                })
        )
    }
}
