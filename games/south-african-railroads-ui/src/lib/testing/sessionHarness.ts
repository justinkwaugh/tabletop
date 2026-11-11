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
    ActionBox,
    BuildTrack,
    ChooseAction,
    Definition,
    HydratedSarGameState,
    MapId,
    MachineState,
    PassBid,
    PlaceBid,
    RailroadId,
    SarRuntime,
    homeLinks,
    type SarGameState
} from '@tabletop/south-african-railroads'
import { UiDefinition } from '$lib/definitions/definition.js'
import { SarUiRuntime } from '$lib/definitions/runtime.js'
import { SarGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...SarRuntime,
            sessionClass: GameSession,
            colorizer: SarUiRuntime.colorizer,
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

const engine = new GameEngine(SarRuntime)
const open: SarGameSession[] = []

export const SEATS = ['p1', 'p2', 'p3']

// A hotseat game, so the seat on screen is the one the state puts on the clock.
const GAME: Game = {
    ...SarRuntime.initializer.initializeGame(
        {
            id: 'sar-session',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 7,
            config: { map: MapId.SouthAfrica },
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

export type PlayedTable = { state: SarGameState; actions: GameAction[] }

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

// Who buys each opening share and what they pay. p1 takes three funded railroads, including the
// CMRC, so it takes the first turn with a choice of builders; p2 and p3 each hold one.
const INITIAL_SALES: Partial<Record<RailroadId, { buyerId: string; price: number }>> = {
    [RailroadId.CdFM]: { buyerId: 'p1', price: 20 },
    [RailroadId.CSAR]: { buyerId: 'p1', price: 20 },
    [RailroadId.NRC]: { buyerId: 'p2', price: 10 },
    [RailroadId.CTRD]: { buyerId: 'p3', price: 10 },
    [RailroadId.CMRC]: { buyerId: 'p1', price: 20 }
}

// The buyer bids its price; everyone else passes. Each free first link takes the first home link.
function initialStep(table: PlayedTable): GameAction {
    const state = new HydratedSarGameState(table.state)
    const playerId = onTheClock(table)
    if (state.machineState === MachineState.FreeBuild) {
        const due = state.freeBuild
        assertExists(due, 'A free build is due')
        const [linkId] = homeLinks(state, state.map.home(due.railroadId))
        return createAction(BuildTrack, {
            ...envelope(table, playerId),
            railroadId: due.railroadId,
            linkIds: [linkId]
        })
    }
    assertExists(state.auction, 'An initial offering is open')
    const sale = INITIAL_SALES[state.auction.railroadId]
    assertExists(sale, `No sale planned for ${state.auction.railroadId}`)
    const bidding = state.bidding()
    if (playerId === sale.buyerId && (!bidding.hasBid || bidding.highBid < sale.price)) {
        return createAction(PlaceBid, { ...envelope(table, playerId), amount: sale.price })
    }
    return createAction(PassBid, envelope(table, playerId))
}

function playInitialOfferingWhile(keepGoing: (table: PlayedTable) => boolean): PlayedTable {
    const { initialState } = engine.startGame(GAME, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: SEATS }
    })
    let table: PlayedTable = { state: initialState, actions: [] }
    for (let step = 0; keepGoing(table); step++) {
        if (step >= 60) {
            throw Error('The initial offering did not finish')
        }
        table = played(table, [initialStep(table)])
    }
    return table
}

// p1 holds the CMRC, so it takes the first turn.
export function firstTurnTable(): PlayedTable {
    return playInitialOfferingWhile(
        (table) => table.state.machineState !== MachineState.ChoosingAction
    )
}

export function initialOfferingTable(railroadsSold: number): PlayedTable {
    return playInitialOfferingWhile(
        (table) =>
            table.state.machineState !== MachineState.Bidding ||
            table.state.railroads.filter((railroad) => railroad.open).length < railroadsSold
    )
}

export function choose(table: PlayedTable, box: ActionBox): PlayedTable {
    return played(table, [
        createAction(ChooseAction, { ...envelope(table, onTheClock(table)), box })
    ])
}

export function openSessionOn(table: PlayedTable): SarGameSession {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: GAME.id
    })
    const session = new SarGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: SarUiRuntime,
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
