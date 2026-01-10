import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedSimpleTurnManager, shuffle } from '@tabletop/common'
import { HydratedSampleGameState, SampleGameState } from '../model/gameState.js'
import { HydratedSamplePlayerState, SamplePlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { SampleGameConfig } from './config.js'
import { SampleColors } from './colors.js'

// This class is responsible for initializing a new Sample game, including setting up the initial game state and
// player states
export class SampleGameInitializer
    extends BaseGameInitializer<SampleGameState, HydratedSampleGameState>
    implements GameInitializer<SampleGameState, HydratedSampleGameState>
{
    // When an exploration state is created, in order to avoid allowing the player to discover
    // hidden information, this method can be used to modify the game state to hide such information.
    // Shuffling the remaining cards in a deck would be a reasonable example.
    initializeExplorationState(state: SampleGameState): SampleGameState {
        return state
    }

    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(
        game: Game,
        state: UninitializedGameState
    ): HydratedSampleGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedSimpleTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: SamplePlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const config = game.config as SampleGameConfig

        const sampleGameState: SampleGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.StartOfTurn,
            turnManager: turnManager,
            total: 0,
            // Example of using the game config to modify initial state
            maxTotal: config.bigTotalsAllowed ? 100 : 200
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        return new HydratedSampleGameState(sampleGameState)
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng): SamplePlayerState[] {
        // Assign colors randomly to players
        const colors = structuredClone(SampleColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedSamplePlayerState({
                playerId: player.id,
                color: colors[index],
                score: 0,
                amount: 50 // Starting amount
            })
        })

        return players
    }
}
