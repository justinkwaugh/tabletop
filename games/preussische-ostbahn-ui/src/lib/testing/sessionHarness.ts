import { flushSync } from 'svelte'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    createAction,
    type Game,
    type GameAction,
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
    DeterminePlayerOrder,
    MachineState,
    OstbahnRuntime,
    PassBid,
    PlaceBid,
    type OstbahnGameState
} from '@tabletop/preussische-ostbahn'
import { UiDefinition } from '$lib/definitions/definition.js'
import { OstbahnUiRuntime } from '$lib/definitions/runtime.js'
import { OstbahnGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...OstbahnRuntime,
            sessionClass: GameSession,
            colorizer: OstbahnUiRuntime.colorizer,
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

const engine = new GameEngine(OstbahnRuntime)
const open: OstbahnGameSession[] = []

export const SEATS = ['p1', 'p2', 'p3']

const GAME: Game = {
    ...OstbahnRuntime.initializer.initializeGame(
        {
            id: 'ostbahn-session',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 7,
            config: {},
            players: SEATS.map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    ),
    hotseat: true
}

export type PlayedTable = { state: OstbahnGameState; actions: GameAction[] }

export function played(table: PlayedTable, actions: readonly GameAction[]): PlayedTable {
    let state = table.state
    const processed = [...table.actions]
    for (const fields of actions) {
        const action = { ...fields, id: `a-${state.actionCount}`, index: state.actionCount }
        const result = engine.executeAction({ action, state, game: GAME })
        processed.push(...result.processedActions)
        state = result.updatedState
    }
    return { state, actions: processed }
}

export function envelope(table: PlayedTable, playerId: string) {
    return { gameId: table.state.gameId, source: ActionSource.User, playerId }
}

export function onTheClock(table: PlayedTable): string {
    const [playerId] = table.state.activePlayerIds
    assertExists(playerId, `No player is on the clock in ${table.state.machineState}`)
    return playerId
}

export function openingDrawTable(): PlayedTable {
    const { initialState } = engine.startGame(GAME, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    let table: PlayedTable = { state: initialState, actions: [] }
    for (let step = 0; table.state.machineState !== MachineState.DeterminingOrder; step++) {
        if (step >= 60) {
            throw Error('The opening auctions did not finish')
        }
        const playerId = onTheClock(table)
        const opening = table.state.shareAuction?.bidding.highBid === undefined
        table = played(table, [
            opening
                ? createAction(PlaceBid, { ...envelope(table, playerId), amount: 4 })
                : createAction(PassBid, envelope(table, playerId))
        ])
    }
    return table
}

export function firstTurnTable(): PlayedTable {
    const table = openingDrawTable()
    return played(table, [
        createAction(DeterminePlayerOrder, {
            ...envelope(table, onTheClock(table)),
            revealsInfo: true
        })
    ])
}

export function withSharesForTurnPlayer(table: PlayedTable): PlayedTable {
    const playerId = onTheClock(table)
    const railroads = table.state.railroads.map((railroad) => ({
        ...railroad,
        owners: [playerId],
        treasury: 20
    }))
    return { ...table, state: { ...table.state, railroads } }
}

export function openSessionOn(table: PlayedTable): OstbahnGameSession {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: GAME.id
    })
    const session = new OstbahnGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: OstbahnUiRuntime,
        game: GAME,
        state: table.state,
        actions: table.actions
    })
    open.push(session)
    flushSync()
    return session
}

export function disposeSessions(): void {
    for (const session of open.splice(0)) session.dispose()
}
