import {
    BaseGameInitializer,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    assert,
    assertExists,
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
import { RideTheRailsInfo } from './info.js'
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
        // R-1.2: three to five players, as printed.
        const { minPlayers, maxPlayers } = RideTheRailsInfo.metadata
        const playerCount = game.players.length
        assert(
            playerCount >= minPlayers && playerCount <= maxPlayers,
            `Ride the Rails takes ${minPlayers} to ${maxPlayers} players, not ${playerCount}`
        )

        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        // R-1.3.7, R-2.3: the turn order is drawn at random. An assigned starting order replaces
        // it after the draw, so position zero is first in turn order, later positions follow,
        // and the seat colours and every other draw match an unassigned game with the same seed.
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const orderedPlayers = turnManager.turnOrder.map((playerId) => {
            const player = players.find((candidate) => candidate.playerId === playerId)
            assertExists(player, `No player ${playerId} in the turn order`)
            return player
        })

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
            // R-1.3.2: a passenger on every city, kept in id order.
            passengers: inCityIdOrder(USA_CITIES.map((city) => city.id))
        })

        const hydrated = new HydratedRideTheRailsGameState(rideTheRailsGameState)
        // R-2.2: Take a Share runs in reverse turn order, so the last player acts first, with an
        // assigned order too; position zero acts first in Build and Ride.
        const firstPlayerId = turnManager.turnOrder.at(-1)
        assertExists(firstPlayerId, 'A game needs players')
        hydrated.turnManager.startTurn(firstPlayerId, state.actionCount)
        hydrated.activePlayerIds = [firstPlayerId]
        return hydrated
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
