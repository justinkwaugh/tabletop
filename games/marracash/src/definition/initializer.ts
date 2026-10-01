import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedMarracashGameState, MarracashGameState } from '../model/gameState.js'
import { HydratedMarracashPlayerState, MarracashPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { MarracashColors } from './colors.js'

// This class is responsible for initializing a new game, including setting up the initial game state and
// player states
export class MarracashGameInitializer
    extends BaseGameInitializer<MarracashGameState, HydratedMarracashGameState>
    implements GameInitializer<MarracashGameState, HydratedMarracashGameState>
{
    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(game: Game, state: UninitializedGameState): HydratedMarracashGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: MarracashPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const marracashGameState: MarracashGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.ChoosingAction,
            turnManager: turnManager
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        return new HydratedMarracashGameState(marracashGameState)
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng): MarracashPlayerState[] {
        // Assign colors randomly to players
        const colors = structuredClone(MarracashColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedMarracashPlayerState({
                playerId: player.id,
                color: colors[index]
            })
        })

        return players
    }
}
