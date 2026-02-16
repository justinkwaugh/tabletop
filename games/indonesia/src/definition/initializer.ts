import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedIndonesiaGameState, IndonesiaGameState } from '../model/gameState.js'
import { HydratedIndonesiaPlayerState, IndonesiaPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { IndonesiaGameConfig } from './config.js'
import { IndonesiaColors } from './colors.js'

// This class is responsible for initializing a new game, including setting up the initial game state and
// player states
export class IndonesiaGameInitializer
    extends BaseGameInitializer<IndonesiaGameState, HydratedIndonesiaGameState>
    implements GameInitializer<IndonesiaGameState, HydratedIndonesiaGameState>
{
    // When an exploration state is created, in order to avoid allowing the player to discover
    // hidden information, this method can be used to modify the game state to hide such information.
    // Shuffling the remaining cards in a deck would be a reasonable example.
    initializeExplorationState(state: IndonesiaGameState): IndonesiaGameState {
        return state
    }

    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(game: Game, state: UninitializedGameState): HydratedIndonesiaGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: IndonesiaPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const config = game.config as IndonesiaGameConfig

        const indonesiaGameState: IndonesiaGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.EndOfGame,
            turnManager: turnManager
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        return new HydratedIndonesiaGameState(indonesiaGameState)
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng): IndonesiaPlayerState[] {
        // Assign colors randomly to players
        const colors = structuredClone(IndonesiaColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedIndonesiaPlayerState({
                playerId: player.id,
                color: colors[index]
            })
        })

        return players
    }
}
