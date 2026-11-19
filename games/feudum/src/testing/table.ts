import {
    ActionSource,
    assertExists,
    GameEngine,
    MachineContext,
    type Game,
    type GameAction
} from '@tabletop/common'
import { handSizeFor, type PouchGood } from '../actions/finaliseHand.js'
import { ActionCards, type ActionCardKind } from '../data/cards.js'
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
    /** Everything processed so far, in order, for a spec that undoes it. */
    readonly processed: GameAction[] = []
    private sent = 0

    constructor(numPlayers = 4) {
        this.game = testGame(numPlayers)
        this.state = engine.startGame(this.game, { masterSeed: MasterSeed }).initialState
    }

    /** Executes one Action canonically and returns everything it processed. */
    send(playerId: string, move: Record<string, unknown> & { type: ActionType }): GameAction[] {
        return this.execute({ source: ActionSource.User, playerId, ...move })
    }

    /** Executes a System Action as a handler's `addSystemAction` would, with its cascade. */
    sendSystem(move: Record<string, unknown> & { type: ActionType }): GameAction[] {
        return this.execute({ source: ActionSource.System, ...move })
    }

    private execute(
        move: Record<string, unknown> & { type: string; source: ActionSource }
    ): GameAction[] {
        this.sent += 1
        const { updatedState, processedActions } = engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action: { id: `a${this.sent}`, gameId: this.game.id, ...move }
        })
        this.state = updatedState
        this.processed.push(...processedActions)
        return processedActions
    }

    /** Whether the engine's validity check takes this Action now, without applying it. */
    accepts(playerId: string, move: Record<string, unknown> & { type: ActionType }): boolean {
        return engine.accepts({
            game: this.game,
            state: this.state,
            action: {
                id: 'check',
                gameId: this.game.id,
                source: ActionSource.User,
                playerId,
                ...move
            }
        })
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

    /**
     * Moves the table as an Action's handler would: `edit` returns the state, which is entered, and
     * any System Action it added then runs.
     */
    moveTo(
        edit: (
            state: HydratedFeudumGameState,
            context: MachineContext<HydratedFeudumGameState>
        ) => MachineState
    ): void {
        const gameState = this.hydrated()
        const context = new MachineContext({ gameConfig: this.game.config, gameState })
        gameState.machineState = edit(gameState, context)
        FeudumRuntime.stateHandlers[gameState.machineState].enter(context)
        this.state = gameState.dehydrate()
        for (const action of context.getPendingActions()) {
            this.execute(action)
        }
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

/** R-3.1, R-3.3 The hand a seat can finalise: as many of `cards` as fit, then any others. */
function legalHand(cards: readonly ActionCardKind[], pouchGood?: PouchGood): ActionCardKind[] {
    const others = ActionCards.map((card) => card.kind)
    return [...new Set([...cards, ...others])].slice(0, handSizeFor(pouchGood))
}

/**
 * R-3.1, R-3.2 A table whose seats finalise in turn and whose starting player is asked for a card.
 * A spec can hold just the cards it is about: each seat finalises a legal hand, pouch good included,
 * then holds what `handOf` says, of any size.
 */
export function tableAtPlayingCards(
    handOf: (playerId: string) => { cards: ActionCardKind[]; pouchGood?: PouchGood } = () => ({
        cards: DefaultHand
    }),
    numPlayers = 4,
    goodsOf?: (playerId: string) => { goods: Good[]; sulfurToBarrel?: boolean }
): Table {
    const table = tableAtHandSelection(numPlayers, goodsOf)
    const hands = table.order.map((playerId) => ({ playerId, ...handOf(playerId) }))
    for (const { playerId, cards, pouchGood } of hands) {
        table.send(playerId, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: legalHand(cards, pouchGood),
            ...(pouchGood ? { pouchGood } : {})
        })
    }
    table.moveTo((state) => {
        for (const { playerId, cards } of hands) {
            const player = state.getPlayerState(playerId)
            player.hand = [...cards]
            player.handCount = cards.length
        }
        return MachineState.PlayingCards
    })
    return table
}
