import { flushSync } from 'svelte'
import {
    ActionSource,
    GameEngine,
    GameStatus,
    GameStorage,
    PlayerStatus,
    createAction,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import {
    Definition,
    HydratedOathGameState,
    OathRuntime,
    Search,
    SearchSource,
    SetupChoice,
    TOP_CRADLE_SLOT,
    type OathProjectedState
} from '@tabletop/oath'
import { UiDefinition } from '$lib/definitions/definition.js'
import { OathUiRuntime } from '$lib/definitions/runtime.js'
import { OathGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        throw new Error('The metadata-only test definition has no runtime')
    }
}

const engine = new GameEngine(OathRuntime)
const open: OathGameSession[] = []

/** A hotseat game, so the seat on screen is the one the state puts on the clock. */
function harnessGame(gameId: string, playerIds: readonly string[], status: GameStatus): Game {
    return {
        id: gameId,
        typeId: Definition.info.id,
        status,
        isPublic: false,
        deleted: false,
        ownerId: 'harness-user',
        name: 'Session',
        players: playerIds.map((id) => ({
            id,
            name: id,
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: true,
        createdAt: new Date(0),
        winningPlayerIds: [],
        storage: GameStorage.Local
    }
}

function gameOf(state: OathProjectedState): Game {
    return harnessGame(
        state.gameId,
        state.players.map((player) => player.playerId),
        GameStatus.Started
    )
}

export type PlayedTable = { state: OathProjectedState; actions: GameAction[] }

/** Runs each action through the engine, keeping what it processed for the session's history. */
export function played(table: PlayedTable, actions: readonly GameAction[]): PlayedTable {
    const game = gameOf(table.state)
    let state = table.state
    const processed = [...table.actions]
    for (const fields of actions) {
        const action = { ...fields, id: `a-${state.actionCount}`, index: state.actionCount }
        const result = engine.executeAction({ action, state, game })
        processed.push(...result.processedActions)
        state = result.updatedState
    }
    return { state, actions: processed }
}

export function openSessionOn(table: PlayedTable): OathGameSession {
    const game = gameOf(table.state)
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: game.id
    })
    const session = new OathGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: OathUiRuntime,
        game,
        state: table.state,
        actions: table.actions
    })
    open.push(session)
    flushSync()
    return session
}

/** A fixture state with no actions behind it. */
export function tableOf(state: HydratedOathGameState): PlayedTable {
    return { state: state.dehydrate(), actions: [] }
}

export function disposeSessions(): void {
    for (const session of open.splice(0)) session.dispose()
}

const SEARCH_SEED = '00000000000000000000000000000001'

/** A three-seat deal at its first setup choice (R-1.23). */
export function setupTable(): PlayedTable {
    const created = harnessGame('game-1', ['p1', 'p2', 'p3'], GameStatus.WaitingToStart)
    const { initialState } = engine.startGame(created, { masterSeed: SEARCH_SEED })
    return { state: initialState, actions: [] }
}

/** The same deal after setup, whose opening Search drew three cards, so a kept card leaves two to order. */
export function searchingTable(): PlayedTable {
    let table = setupTable()
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    for (const playerId of table.state.turnManager.turnOrder) {
        const hydrated = new HydratedOathGameState(table.state)
        const hand = hydrated.getPlayerState(playerId).knownHand()
        const siteId =
            playerId === table.state.chancellorPlayerId
                ? TOP_CRADLE_SLOT
                : hydrated.faceupSiteIds()[1]
        table = played(table, [
            createAction(SetupChoice, {
                ...envelope,
                playerId,
                siteId,
                adviserCardId: hand[0],
                discardOrder: hand.slice(1)
            })
        ])
    }
    return played(table, [
        createAction(Search, {
            ...envelope,
            playerId: table.state.chancellorPlayerId,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        })
    ])
}
