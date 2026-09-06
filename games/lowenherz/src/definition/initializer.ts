import {
    assert,
    assertExists,
    type ExplorationPopulation,
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import {
    HydratedLowenherzGameState,
    LowenherzGameState,
    LowenherzGameStateValidator,
    LowenherzProjectedState
} from '../model/gameState.js'
import { HydratedLowenherzPlayerState, LowenherzPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { LowenherzGameConfig } from './config.js'
import { LowenherzColors } from './colors.js'
import { assembleBoard } from '../util/boardAssembly.js'
import {
    assembleActionDeck,
    assembleActionDeckWithConstruction
} from '../util/actionDeckAssembly.js'
import { assembleStandardBoard, applyStandardSetup } from '../util/standardSetup.js'
import { populateLowenherzExploration } from '../util/exploration.js'
import { AdvanceResolution } from '../actions/advanceResolution.js'
import { MachineContext, type GameAction } from '@tabletop/common'
import { dealPoliticsCardPiles } from '../util/politicsCardAssembly.js'

const STARTING_MONEY = 12
const STARTING_KNIGHTS = 12

// This class is responsible for initializing a new game, including setting up the initial game state and
// player states
export class LowenherzGameInitializer
    extends BaseGameInitializer<LowenherzProjectedState, HydratedLowenherzGameState>
    implements GameInitializer<LowenherzProjectedState, HydratedLowenherzGameState>
{
    initializeExplorationState(state: LowenherzProjectedState): LowenherzProjectedState {
        const hydrated = new HydratedLowenherzGameState(state)
        const deck = hydrated.getActionDeck()
        const backs = [...new Set(deck.map((card) => card.back))]
        hydrated.actionDeck = backs.flatMap((back) => {
            const group = deck.filter((card) => card.back === back)
            shuffle(group, Math.random)
            return group
        })
        const pooled = [...hydrated.getPoliticsPile('A'), ...hydrated.getPoliticsPile('B')]
        shuffle(pooled, Math.random)
        const size = hydrated.getPoliticsPile('A').length
        hydrated.politicsCardPileA = pooled.slice(0, size)
        hydrated.politicsCardPileB = pooled.slice(size)
        for (const player of hydrated.players) {
            if (player.politicsInspection) {
                player.politicsInspection.cards = structuredClone(
                    hydrated.getPoliticsPile(player.politicsInspection.pile)
                )
            }
        }
        return hydrated.dehydrate()
    }

    populateExplorationState(
        input: ExplorationPopulation<LowenherzProjectedState>
    ): LowenherzGameState {
        if ((input.state.systemVersion ?? 1) < 3) {
            const state = this.initializeExplorationState(input.state)
            assert(
                LowenherzGameStateValidator.Check(state),
                'Legacy Exploration requires complete state'
            )
            return state
        }
        return populateLowenherzExploration(input)
    }

    getExplorationActions(game: Game, state: LowenherzProjectedState): GameAction[] {
        if (state.machineState !== MachineState.ResolvingActions) return []
        const hydrated = new HydratedLowenherzGameState(state)
        const context = new MachineContext({ gameConfig: game.config, gameState: hydrated })
        context.addSystemAction(AdvanceResolution, { playerId: '' })
        return context.getPendingActions()
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedLowenherzGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: HydratedLowenherzPlayerState[] = []
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

        const privateInformation = (state.systemVersion ?? 1) >= 3
        const hiddenPrngState = privateInformation ? state.protectedPrng : state.prng
        assertExists(hiddenPrngState, 'Protected initialization requires protectedPrng')
        const hiddenPrng = privateInformation ? new Prng(hiddenPrngState) : prng
        const lowenherzGameState: LowenherzProjectedState = Object.assign(state, {
            players: orderedPlayers,
            machineState: playerPlacedCastles
                ? MachineState.PlacingCastles
                : MachineState.StartOfTurn,
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

            actionDeck: playerPlacedCastles
                ? assembleActionDeckWithConstruction(hiddenPrng)
                : assembleActionDeck(hiddenPrng),
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

            ...dealPoliticsCardPiles(hiddenPrng),
            ...(privateInformation ? { privateInformation: true as const } : {}),
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
    private initializePlayers(game: Game, prng: Prng): HydratedLowenherzPlayerState[] {
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
