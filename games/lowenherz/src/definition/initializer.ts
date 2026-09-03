import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import {
    HydratedLowenherzGameState,
    LowenherzGameState,
    RULEBOOK_CASTLE_MIN_DISTANCE
} from '../model/gameState.js'
import { HydratedLowenherzPlayerState, LowenherzPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { LowenherzGameConfig } from './config.js'
import { LowenherzColors } from './colors.js'
import { assembleBoard } from '../util/boardAssembly.js'
import { assembleActionDeck, assembleActionDeckWithConstruction } from '../util/actionDeckAssembly.js'
import { assembleStandardBoard, applyStandardSetup } from '../util/standardSetup.js'
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
    //
    // This game has three such sources, and returning the state untouched handed all of
    // them over: actionDeck is ordered (index 0 draws next) and the position of the King is
    // Dead card is literally when the game ends, and each politics pile is face-down until
    // a Crown-and-Scepter winner looks through one. Shuffled in place with Math.random
    // rather than the state's own seeded prng - an exploration branch must not be
    // reproducible from the real game's seed, and the same pattern is used by
    // santiago/estates/fresh-fish.
    initializeExplorationState(state: LowenherzGameState): LowenherzGameState {
        const explorationState = structuredClone(state)

        // The action deck is ordered - index 0 draws next - so shuffling it is what stops an
        // exploration branch being read as an oracle for the real game's next cards.
        shuffle(explorationState.actionDeck, () => Math.random())

        // The politics piles are NOT ordered: a player commits to a pile and takes whichever
        // card in it they like, by id. Shuffling each pile in place therefore hides nothing -
        // the same cards stay in the same pile. What is concealed is which pile holds what, so
        // the two are pooled and redealt at their original sizes.
        const pooled = [
            ...explorationState.politicsCardPileA,
            ...explorationState.politicsCardPileB
        ]
        shuffle(pooled, () => Math.random())
        const pileASize = explorationState.politicsCardPileA.length
        explorationState.politicsCardPileA = pooled.slice(0, pileASize)
        explorationState.politicsCardPileB = pooled.slice(pileASize)

        return explorationState
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
        // Defaults to on (player-placed castles/knights, via the PlacingCastles flow) -
        // turning it off uses the rulebook's fixed "basic game" board/castle/knight/
        // wall layout instead, skipping manual placement entirely.
        //
        // Except at 2 players, where the variant is built on manual placement: "each
        // player places 4 castles and 4 knights in his color using the variable
        // construction rules", then 2 castles and 2 knights of the neutral color. The
        // basic game's printed layout is a 4-color, 1-castle-each diagram with no neutral
        // prince at all, so honoring the option here would quietly discard the whole
        // 2-player variant. Enforced at initialization rather than in the setup UI because
        // the platform's configurator only ever sees the config (validateConfig takes no
        // player list), and players can join after it's been set anyway.
        const playerPlacedCastles = players.length === 2 || config.playerPlacedCastles !== false

        // 2- and 3-player games use one of the unused colors as a neutral color (an
        // obstacle-only "prince" in 3p, or the 2-player variant's dedicated neutral
        // color in 2p). 4-player games use all 4 colors, so there's none left over.
        const neutralColor =
            players.length < 4
                ? LowenherzColors.find((color) => !players.some((p) => p.color === color))
                : undefined

        const lowenherzGameState: LowenherzGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: playerPlacedCastles ? MachineState.PlacingCastles : MachineState.StartOfTurn,
            turnManager: turnManager,
            board: playerPlacedCastles ? assembleBoard(prng) : assembleStandardBoard(),
            regions: [],
            alliances: [],
            // Cloned, not aliased: turnManager.turnOrder gets rotated in place by
            // generic engine bookkeeping (e.g. newFirstPlayer()) as turns advance, but
            // our own turnOrder must stay fixed as the seating order for the whole game.
            turnOrder: [...turnManager.turnOrder],
            firstPlayerId: turnManager.turnOrder[0],
            neutralColor,
            minimumOneDucat: config.minimumOneDucat !== false,
            minimumCastleDistance: RULEBOOK_CASTLE_MIN_DISTANCE,

            actionDeck: playerPlacedCastles
                ? assembleActionDeckWithConstruction(prng)
                : assembleActionDeck(prng),
            currentActionCard: undefined,
            discardedActionCard: undefined,
            decisions: [],

            resolvedSlots: [],
            negotiation: undefined,
            duel: undefined,
            wallsRemaining: undefined,
            wallPlacingPlayerId: undefined,
            knightsRemaining: undefined,
            knightPlacingPlayerId: undefined,

            ...dealPoliticsCardPiles(prng),
            politicsTakingPlayerId: undefined,
            openedPoliticsPile: undefined
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        const hydratedState = new HydratedLowenherzGameState(lowenherzGameState)
        if (!playerPlacedCastles) {
            applyStandardSetup(hydratedState)
        }
        return hydratedState
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
