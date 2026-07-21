import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { HydratedLowenherzPlayerState, LowenherzPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { LowenherzGameConfig } from './config.js'
import { LowenherzColors } from './colors.js'
import { assembleBoard } from '../util/boardAssembly.js'
import { assembleActionDeck } from '../util/actionDeckAssembly.js'
import { dealPoliticsCardPiles } from '../util/politicsCardAssembly.js'

const STARTING_MONEY = 12
const STARTING_KNIGHTS = 12

// This class is responsible for initializing a new game, including setting up the initial game state and
// player states
export class LowenherzGameInitializer
    extends BaseGameInitializer<LowenherzGameState, HydratedLowenherzGameState>
    implements GameInitializer<LowenherzGameState, HydratedLowenherzGameState>
{
    // When an exploration state is created, in order to avoid allowing the player to discover
    // hidden information, this method can be used to modify the game state to hide such information.
    // Shuffling the remaining cards in a deck would be a reasonable example.
    initializeExplorationState(state: LowenherzGameState): LowenherzGameState {
        return state
    }

    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(
        game: Game,
        state: UninitializedGameState
    ): HydratedLowenherzGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: LowenherzPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const config = game.config as LowenherzGameConfig

        // 2- and 3-player games use one of the unused colors as a neutral color (an
        // obstacle-only "prince" in 3p, or the 2-player variant's dedicated neutral
        // color in 2p). 4-player games use all 4 colors, so there's none left over.
        const neutralColor =
            players.length < 4
                ? LowenherzColors.find((color) => !players.some((p) => p.color === color))
                : undefined

        const lowenherzGameState: LowenherzGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.PlacingCastles,
            turnManager: turnManager,
            board: assembleBoard(prng),
            regions: [],
            alliances: [],
            // Cloned, not aliased: turnManager.turnOrder gets rotated in place by
            // generic engine bookkeeping (e.g. newFirstPlayer()) as turns advance, but
            // our own turnOrder must stay fixed as the seating order for the whole game.
            turnOrder: [...turnManager.turnOrder],
            firstPlayerId: turnManager.turnOrder[0],
            neutralColor,

            actionDeck: assembleActionDeck(prng),
            currentActionCard: undefined,
            decisions: [],

            resolvedSlots: [],
            negotiation: undefined,
            duel: undefined,
            wallsRemaining: undefined,
            wallPlacingPlayerId: undefined,
            knightsRemaining: undefined,
            knightPlacingPlayerId: undefined,

            ...dealPoliticsCardPiles(prng),
            politicsTakingPlayerId: undefined
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        return new HydratedLowenherzGameState(lowenherzGameState)
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng): LowenherzPlayerState[] {
        // Assign colors randomly to players
        const colors = structuredClone(LowenherzColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedLowenherzPlayerState({
                playerId: player.id,
                color: colors[index],
                money: STARTING_MONEY,
                powerPoints: 0,
                knightsInStock: STARTING_KNIGHTS,
                politicsCards: []
            })
        })

        return players
    }
}
