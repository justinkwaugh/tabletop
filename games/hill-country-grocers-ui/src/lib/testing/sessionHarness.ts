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
    ActionSpace,
    ChooseAction,
    CompanyId,
    Definition,
    Develop,
    HcgRuntime,
    HydratedHcgGameState,
    MachineState,
    PassBid,
    PlaceBid,
    TakeDevelopmentCash,
    type HcgGameState
} from '@tabletop/hill-country-grocers'
import { UiDefinition } from '$lib/definitions/definition.js'
import { HcgUiRuntime } from '$lib/definitions/runtime.js'
import { HcgGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...HcgRuntime,
            sessionClass: GameSession,
            colorizer: HcgUiRuntime.colorizer,
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

const engine = new GameEngine(HcgRuntime)
const open: HcgGameSession[] = []

export const SEATS = ['p1', 'p2', 'p3']

// A hotseat game, so the seat on screen is the one the state puts on the clock.
const GAME: Game = {
    ...HcgRuntime.initializer.initializeGame(
        {
            id: 'hcg-session',
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

export type PlayedTable = { state: HcgGameState; actions: GameAction[] }

// Runs each action through the engine, keeping what it processed for the session's history.
function played(table: PlayedTable, actions: readonly GameAction[]): PlayedTable {
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

function envelope(table: PlayedTable, playerId: string) {
    return { gameId: table.state.gameId, source: ActionSource.User, playerId }
}

function onTheClock(table: PlayedTable): string {
    const [playerId] = table.state.activePlayerIds
    assertExists(playerId, `No player is on the clock in ${table.state.machineState}`)
    return playerId
}

// Who buys each company's opening share and what they pay. p2 can then build for two grocers,
// p3 only for Comestibles, and Balcones Builders holds $1, too little to pay both San Antonio
// grocers.
const INITIAL_SALES: Record<CompanyId, { buyerId: string; price: number }> = {
    [CompanyId.AlamoCity]: { buyerId: 'p2', price: 4 },
    [CompanyId.Verbena]: { buyerId: 'p2', price: 4 },
    [CompanyId.Streamside]: { buyerId: 'p3', price: 0 },
    [CompanyId.CompleteComestibles]: { buyerId: 'p3', price: 4 },
    [CompanyId.Balcones]: { buyerId: 'p3', price: 1 }
}

// Seat one opens every auction it does not win; the buyer bids its price and everyone else passes.
function initialBid(table: PlayedTable): GameAction {
    const state = new HydratedHcgGameState(table.state)
    const playerId = onTheClock(table)
    assertExists(state.auction, 'An initial auction is open')
    const { buyerId, price } = INITIAL_SALES[state.auction.companyId]
    const bidding = state.bidding()
    if (playerId === buyerId && (!bidding.hasBid || bidding.highBid < price)) {
        const amount = Math.max(price, state.smallestBid())
        return createAction(PlaceBid, { ...envelope(table, playerId), amount })
    }
    if (!bidding.hasBid) {
        return createAction(PlaceBid, { ...envelope(table, playerId), amount: 0 })
    }
    return createAction(PassBid, envelope(table, playerId))
}

// After the initial auctions p1, the richest, takes the first turn.
export function firstTurnTable(): PlayedTable {
    const { initialState } = engine.startGame(GAME, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: SEATS }
    })
    let table: PlayedTable = { state: initialState, actions: [] }
    for (let step = 0; table.state.machineState === MachineState.Bidding; step++) {
        if (step >= 50) {
            throw Error('The initial auctions did not finish')
        }
        table = played(table, [initialBid(table)])
    }
    return table
}

export function choose(table: PlayedTable, space: ActionSpace): PlayedTable {
    return played(table, [
        createAction(ChooseAction, { ...envelope(table, onTheClock(table)), space })
    ])
}

// Develops a city no grocer serves and takes $1, ending the turn without touching any company.
export function developAndTakeCash(table: PlayedTable, cityId: string): PlayedTable {
    const developing = choose(table, ActionSpace.DevelopTowns)
    const playerId = onTheClock(developing)
    return played(developing, [
        createAction(Develop, { ...envelope(developing, playerId), cityId }),
        createAction(TakeDevelopmentCash, envelope(developing, playerId))
    ])
}

// p2 to build, holding Alamo City Supplies and Verbena.
export function twoGrocerBuildTable(): PlayedTable {
    return choose(developAndTakeCash(firstTurnTable(), 'kerrville'), ActionSpace.BuildNetwork)
}

// p3 to build, holding Complete Comestibles as its only grocer with money.
export function oneGrocerBuildTable(): PlayedTable {
    const p2Turn = developAndTakeCash(firstTurnTable(), 'kerrville')
    return choose(developAndTakeCash(p2Turn, 'hondo'), ActionSpace.BuildNetwork)
}

export function openSessionOn(table: PlayedTable): HcgGameSession {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: GAME.id
    })
    const session = new HcgGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: HcgUiRuntime,
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
