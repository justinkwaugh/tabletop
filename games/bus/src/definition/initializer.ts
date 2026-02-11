import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedBusGameState, BusGameState } from '../model/gameState.js'
import { HydratedBusPlayerState, BusPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { BusColors } from './colors.js'
import { Passenger } from '../components/passenger.js'
import { HydratedGameBoard } from '../components/board.js'
import { BuildingType } from '../components/building.js'

// This class is responsible for initializing a new game, including setting up the initial game state and
// player states
export class BusGameInitializer
    extends BaseGameInitializer<BusGameState, HydratedBusGameState>
    implements GameInitializer<BusGameState, HydratedBusGameState>
{
    // When an exploration state is created, in order to avoid allowing the player to discover
    // hidden information, this method can be used to modify the game state to hide such information.
    // Shuffling the remaining cards in a deck would be a reasonable example.
    initializeExplorationState(state: BusGameState): BusGameState {
        return state
    }

    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(game: Game, state: UninitializedGameState): HydratedBusGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: BusPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const passengers: Passenger[] = []
        for (let i = 0; i < 15; i++) {
            passengers.push({
                id: prng.randId()
            })
        }

        const initialBoardPassengers = passengers.splice(0, 4)
        initialBoardPassengers[0].nodeId = 'N14'
        initialBoardPassengers[1].nodeId = 'N17'
        initialBoardPassengers[2].nodeId = 'N19'
        initialBoardPassengers[3].nodeId = 'N24'

        const board = new HydratedGameBoard({
            buildings: {},
            passengers: initialBoardPassengers
        })

        const busGameState: BusGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.InitialBuildingPlacement,
            turnManager: turnManager,
            board: board,
            passengers,
            currentLocation: BuildingType.House,
            currentBuildingPhase: 1,
            initialBuildingsPlaced: 0,
            lineExpansionAction: [],
            busAction: undefined,
            passengersAction: [],
            buildingAction: [],
            clockAction: undefined,
            vroomAction: [],
            startingPlayerAction: undefined,
            passedPlayers: []
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        return new HydratedBusGameState(busGameState)
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng): BusPlayerState[] {
        // Assign colors randomly to players
        const colors = structuredClone(BusColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedBusPlayerState({
                playerId: player.id,
                color: colors[index],
                actions: 20,
                sticks: 25,
                buses: 1,
                stones: 0,
                score: 0,
                busLine: [],
                numActionsChosen: 0
            })
        })

        return players
    }
}
