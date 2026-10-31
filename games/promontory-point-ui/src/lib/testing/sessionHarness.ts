import { flushSync } from 'svelte'
import {
    GameEngine,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type GameAction,
    type GameConfig,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import {
    Definition,
    PromontoryPointRuntime,
    type PromontoryPointGameState
} from '@tabletop/promontory-point'
import { UiDefinition } from '$lib/definitions/definition.js'
import { PromontoryPointUiRuntime } from '$lib/definitions/runtime.js'
import { PromontoryPointGameSession } from '$lib/model/session.svelte.js'
import { canonical } from '@tabletop/promontory-point/testing'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...PromontoryPointRuntime,
            sessionClass: GameSession,
            colorizer: PromontoryPointUiRuntime.colorizer,
            gameUI: {
                load: async () => {
                    throw Error('The session harness does not render a table')
                },
                mount: () => {
                    throw Error('The session harness does not render a table')
                }
            }
        }
    }
}

export const HARNESS_MASTER_SEED = '0123456789abcdef0123456789abcdef'

const engine = new GameEngine(PromontoryPointRuntime)
const open: PromontoryPointGameSession[] = []

export type Table = {
    game: Game
    state: PromontoryPointGameState
    actions: GameAction[]
    // docs/request-performance.md: false opens on the state alone, its history still to load.
    historyComplete?: boolean
}

// A hotseat game, so the seat on screen is the one the state asks to decide.
function harnessGame(playerCount: number, config: GameConfig, status: GameStatus): Game {
    return {
        id: `promontory-point-session-${playerCount}`,
        typeId: Definition.info.id,
        status,
        isPublic: false,
        deleted: false,
        ownerId: 'harness-user',
        name: 'Session',
        players: Array.from({ length: playerCount }, (_, index) => ({
            id: `p${index + 1}`,
            name: `p${index + 1}`,
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        config,
        hotseat: true,
        createdAt: new Date(0),
        winningPlayerIds: [],
        storage: GameStorage.Local
    }
}

// R-1.3: a dealt table at turn 1, the starting player's pieces face up.
export function dealtTable(
    options: { playerCount?: number; config?: GameConfig; masterSeed?: string } = {}
): Table {
    const created = harnessGame(
        options.playerCount ?? 3,
        options.config ?? {},
        GameStatus.WaitingToStart
    )
    const { startedGame, initialState } = engine.startGame(created, {
        masterSeed: options.masterSeed ?? HARNESS_MASTER_SEED
    })
    return {
        game: { ...startedGame, status: GameStatus.Started },
        state: canonical(initialState),
        actions: []
    }
}

// The same table with its state edited by a fixture recipe; no actions behind it.
export function editedTable(
    table: Table,
    edit: (state: PromontoryPointGameState) => PromontoryPointGameState
): Table {
    return { ...table, state: edit(table.state), actions: [] }
}

// Opens a session on the table and resolves once the opening state is shown.
export async function openSessionOn(table: Table): Promise<PromontoryPointGameSession> {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    // The harness keeps local games in IndexedDB, which vitest's environment does not have.
    appContext.gameService.saveGameLocally = async () => {}
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: table.game.id
    })
    const session = new PromontoryPointGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: PromontoryPointUiRuntime,
        game: table.game,
        state: table.state,
        actions: table.actions,
        historyComplete: table.historyComplete
    })
    open.push(session)
    flushSync()
    await session.waitForVisibleTransitionSettled()
    return session
}

// Lets a sent action or an Undo reach the screen before the spec reads the session.
export async function settled(session: PromontoryPointGameSession): Promise<void> {
    flushSync()
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

export function disposeSessions(): void {
    for (const session of open.splice(0)) session.dispose()
}
