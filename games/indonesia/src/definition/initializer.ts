import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedIndonesiaGameState, IndonesiaGameState } from '../model/gameState.js'
import { HydratedIndonesiaPlayerState, IndonesiaPlayerState } from '../model/playerState.js'
import { HydratedIndonesiaBoard } from '../components/board.js'

import { MachineState } from './states.js'
import { IndonesiaColors } from './colors.js'
import { CityCards } from '../components/cards.js'
import { Era } from './eras.js'
import { Deeds } from '../components/deed.js'

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

        const board = new HydratedIndonesiaBoard({})

        const eraADeeds = structuredClone(Deeds.filter((deed) => deed.era === Era.A))

        const indonesiaGameState: IndonesiaGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.EndOfGame,
            turnManager: turnManager,
            board: board,
            availableDeeds: eraADeeds
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

        const eraACards = CityCards.filter((card) => card.era === Era.A)
        const eraBCards = CityCards.filter((card) => card.era === Era.B)
        const eraCCards = CityCards.filter((card) => card.era === Era.C)

        shuffle(eraACards, prng.random)
        shuffle(eraBCards, prng.random)
        shuffle(eraCCards, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedIndonesiaPlayerState({
                playerId: player.id,
                color: colors[index],
                research: {
                    bid: 0,
                    slots: 0,
                    mergers: 0,
                    expansion: 0,
                    hull: 0
                },
                bank: 0,
                cash: 100,
                cityCards: {
                    [Era.A]: structuredClone(eraACards[index]),
                    [Era.B]: structuredClone(eraBCards[index]),
                    [Era.C]: structuredClone(eraCCards[index])
                }
            })
        })

        return players
    }
}
