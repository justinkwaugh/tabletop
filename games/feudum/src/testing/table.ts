import {
    ActionSource,
    assertExists,
    GameEngine,
    MachineContext,
    type Game,
    type GameAction
} from '@tabletop/common'
import type { PouchGood } from '../actions/finaliseHand.js'
import type { ActionCardKind } from '../data/cards.js'
import type { Good } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { FeudumRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'
import type { HydratedFeudumPlayerState } from '../model/playerState.js'
import { testGame } from './state.js'

const engine = new GameEngine(FeudumRuntime)
const MasterSeed = '0123456789abcdef0123456789abcdef'

/** A game driven through the engine, for specs that assert an Action's whole cascade. */
export class Table {
    readonly game: Game
    state: FeudumProjectedState
    private sent = 0

    constructor(numPlayers = 4) {
        this.game = testGame(numPlayers)
        this.state = engine.startGame(this.game, { masterSeed: MasterSeed }).initialState
    }

    /** Executes one Action canonically and returns everything it processed. */
    send(playerId: string, move: Record<string, unknown> & { type: ActionType }): GameAction[] {
        this.sent += 1
        const { updatedState, processedActions } = engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action: {
                id: `a${this.sent}`,
                gameId: this.game.id,
                source: ActionSource.User,
                playerId,
                ...move
            }
        })
        this.state = updatedState
        return processedActions
    }

    /** What the engine offers this seat now. */
    offered(playerId: string): string[] {
        return engine.getValidActionTypesForPlayer(this.game, this.state, playerId)
    }

    hydrated(): HydratedFeudumGameState {
        return new HydratedFeudumGameState(this.state)
    }

    seat(playerId: string): HydratedFeudumPlayerState {
        return this.hydrated().getPlayerState(playerId)
    }

    /** Moves the table as an Action's handler would: `edit` returns the state, which is entered. */
    moveTo(edit: (state: HydratedFeudumGameState) => MachineState): void {
        const gameState = this.hydrated()
        gameState.machineState = edit(gameState)
        FeudumRuntime.stateHandlers[gameState.machineState].enter(
            new MachineContext({ gameConfig: this.game.config, gameState })
        )
        this.state = gameState.dehydrate()
    }

    /** R-2.2.5 */
    get order(): string[] {
        return this.state.turnManager.turnOrder
    }

    /** The one seat the state machine is asking. */
    get asked(): string {
        const [playerId] = this.state.activePlayerIds
        assertExists(playerId, 'A seat is being asked')
        return playerId
    }
}

/** R-1.4.8, R-1.4.9 A table past setup; `goodsOf` chooses each seat's starting goods. */
export function tableAtHandSelection(
    numPlayers = 4,
    goodsOf: (playerId: string) => { goods: Good[]; sulfurToBarrel?: boolean } = () => ({
        goods: ['saltpeter', 'sulfur', 'iron']
    })
): Table {
    const table = new Table(numPlayers)
    for (const playerId of table.order) {
        table.send(playerId, { type: ActionType.ChooseStartingGoods, ...goodsOf(playerId) })
    }
    for (const playerId of table.order) {
        table.send(playerId, {
            type: ActionType.PlaceStartingPawn,
            character: 'farmer',
            spaceId: 'space.desert.3'
        })
    }
    return table
}

const DefaultHand: ActionCardKind[] = ['move', 'tax', 'guild', 'explore']

/**
 * R-3.1, R-3.2 A table whose hands are dealt as `handOf` says, of any size, and whose starting
 * player is asked for a card. Hands go straight on the table, so a spec can hold just the cards
 * it is about; a pouch good moves off the seat's goods, keeping totals.
 */
export function tableAtPlayingCards(
    handOf: (playerId: string) => { cards: ActionCardKind[]; pouchGood?: PouchGood } = () => ({
        cards: DefaultHand
    }),
    numPlayers = 4,
    goodsOf?: (playerId: string) => { goods: Good[]; sulfurToBarrel?: boolean }
): Table {
    const table = tableAtHandSelection(numPlayers, goodsOf)
    table.moveTo((state) => {
        for (const playerId of table.order) {
            const { cards, pouchGood } = handOf(playerId)
            const player = state.getPlayerState(playerId)
            player.hand = [...cards]
            player.handCount = cards.length
            if (pouchGood) {
                player.goods[pouchGood] -= 1
                player.pouch = pouchGood
            }
        }
        state.flow.selection = undefined
        return MachineState.PlayingCards
    })
    return table
}
