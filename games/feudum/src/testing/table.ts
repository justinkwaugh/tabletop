import {
    ActionSource,
    assertExists,
    GameEngine,
    type Game,
    type GameAction
} from '@tabletop/common'
import type { Good } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { FeudumRuntime } from '../definition/runtime.js'
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
