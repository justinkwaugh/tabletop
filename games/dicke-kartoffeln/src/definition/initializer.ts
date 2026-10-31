import {
    BaseGameInitializer,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    FARM_COUNT,
    FIELD_COUNT,
    STARTING_CASH,
    STARTING_SUNFLOWERS,
    STARTING_WORMS
} from '../components/costs.js'
import { marketBoardFor, startingPosition } from '../components/marketBoards.js'
import { MESSAGE_IDS, MESSAGE_SPACE_IDS } from '../components/messages.js'
import { MARKET_IDS } from '../components/potatoes.js'
import {
    HydratedDickeKartoffelnGameState,
    type DickeKartoffelnGameState,
    type DickeKartoffelnProjectedState
} from '../model/gameState.js'
import { HydratedMessageDeck, type MessageBoard } from '../model/messageDeck.js'
import { HydratedDickeKartoffelnPlayerState } from '../model/playerState.js'
import { nextRound } from '../stateHandlers/flow.js'
import { DickeKartoffelnColors } from './colors.js'
import { readSetup, usesMessages } from './setup.js'
import { MachineState } from './states.js'

export class DickeKartoffelnGameInitializer
    extends BaseGameInitializer<DickeKartoffelnProjectedState, HydratedDickeKartoffelnGameState>
    implements GameInitializer<DickeKartoffelnProjectedState, HydratedDickeKartoffelnGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedDickeKartoffelnGameState {
        const setup = readSetup(game.config)
        const prng = new Prng(state.prng)
        const colors = [...DickeKartoffelnColors]
        shuffle(colors, prng.random)
        const farms = Array.from({ length: FARM_COUNT }, (_, index) => index + 1)
        shuffle(farms, prng.random)
        const players = game.players.map(
            (player, index) =>
                new HydratedDickeKartoffelnPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    farm: farms[index],
                    cash: STARTING_CASH,
                    loans: 0,
                    fields: Array.from({ length: FIELD_COUNT }, (_, fieldIndex) => ({
                        id: fieldIndex + 1,
                        worms: STARTING_WORMS,
                        sunflowers: STARTING_SUNFLOWERS,
                        skull: false,
                        furrow: false,
                        fertilizer: 0,
                        poison: false
                    })),
                    freshCompost: 0,
                    ripeCompost: 0
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const board = marketBoardFor(players.length)
        const years = HydratedRoundManager.generate()
        years.startRound(0)
        const gameState: DickeKartoffelnGameState = Object.assign(state, {
            players,
            machineState: MachineState.TakingCompost,
            turnManager,
            years,
            markets: MARKET_IDS.map((id) => ({
                id,
                ...startingPosition(board, players.length, id)
            })),
            contests: [],
            ...(usesMessages(setup) ? { messages: this.dealMessages(state) } : {})
        })
        const hydrated = new HydratedDickeKartoffelnGameState(gameState)
        hydrated.machineState = nextRound(hydrated, setup)
        return hydrated
    }

    // The deck order is secret, so it is shuffled from the protected stream.
    private dealMessages(state: UninitializedGameState): MessageBoard {
        assertExists(state.protectedPrng, 'Shuffling the messages requires protected randomness')
        const deckPrng = new Prng(state.protectedPrng)
        const deck = new HydratedMessageDeck({
            items: [...MESSAGE_IDS],
            remaining: MESSAGE_IDS.length
        })
        deck.shuffle(deckPrng.random)
        const spaces = MESSAGE_SPACE_IDS.map((space) => ({ space, messageId: deck.draw() }))
        return { deck: deck.dehydrate(), spaces, read: [] }
    }
}
