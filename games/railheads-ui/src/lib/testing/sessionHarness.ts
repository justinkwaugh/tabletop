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
    ActionSpaceId,
    ChooseAction,
    CompanyId,
    Definition,
    HydratedRailheadsGameState,
    InvestInIndustry,
    Industry,
    LayTrack,
    MachineState,
    PassBid,
    PlaceBid,
    RailheadsRuntime,
    type RailheadsProjectedState
} from '@tabletop/railheads'
import { UiDefinition } from '$lib/definitions/definition.js'
import { RailheadsUiRuntime } from '$lib/definitions/runtime.js'
import { RailheadsGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...RailheadsRuntime,
            sessionClass: GameSession,
            colorizer: RailheadsUiRuntime.colorizer,
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

const engine = new GameEngine(RailheadsRuntime)
const open: RailheadsGameSession[] = []

export const SEATS = ['p1', 'p2', 'p3']

function gameWith(config: Record<string, boolean | string>): Game {
    return {
        ...RailheadsRuntime.initializer.initializeGame(
            {
                id: 'railheads-session',
                typeId: Definition.info.id,
                ownerId: 'owner',
                seed: 7,
                config,
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
}

const GAME = gameWith({})

export type PlayedTable = { state: RailheadsProjectedState; actions: GameAction[]; game?: Game }

function played(table: PlayedTable, actions: readonly GameAction[]): PlayedTable {
    let state = table.state
    const processed = [...table.actions]
    for (const fields of actions) {
        const action = { ...fields, id: `a-${state.actionCount}`, index: state.actionCount }
        const result = engine.executeAction({ action, state, game: table.game ?? GAME })
        processed.push(...result.processedActions)
        state = result.updatedState
    }
    return { ...table, state, actions: processed }
}

function envelope(table: PlayedTable, playerId: string) {
    return { gameId: table.state.gameId, source: ActionSource.User, playerId }
}

export function onTheClock(table: PlayedTable): string {
    const [playerId] = table.state.activePlayerIds
    assertExists(playerId, `No player is on the clock in ${table.state.machineState}`)
    return playerId
}

const INITIAL_BUYERS: Record<CompanyId, string> = {
    [CompanyId.KPEV]: 'p1',
    [CompanyId.GBSE]: 'p2',
    [CompanyId.KSSE]: 'p3',
    [CompanyId.KWSE]: 'p1',
    [CompanyId.KBSB]: 'p1'
}

function initialStep(table: PlayedTable): GameAction {
    const state = new HydratedRailheadsGameState(table.state)
    const playerId = onTheClock(table)
    const auction = state.shareAuction
    assertExists(auction, 'An opening auction is open')
    if (playerId === INITIAL_BUYERS[auction.companyId] && !state.bidding().hasBid) {
        return createAction(PlaceBid, { ...envelope(table, playerId), amount: auction.minimum })
    }
    return createAction(PassBid, envelope(table, playerId))
}

export function firstTurnTable(config: Record<string, boolean | string> = {}): PlayedTable {
    const game = gameWith(config)
    const { initialState } = engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: SEATS }
    })
    let table: PlayedTable = { state: initialState, actions: [], game }
    for (let step = 0; table.state.machineState !== MachineState.ChoosingAction; step++) {
        if (step >= 60) {
            throw Error('The opening auctions did not finish')
        }
        table = played(table, [initialStep(table)])
    }
    return table
}

export function choose(table: PlayedTable, space: ActionSpaceId): PlayedTable {
    return played(table, [
        createAction(ChooseAction, { ...envelope(table, onTheClock(table)), space })
    ])
}

export function invest(table: PlayedTable, industry: Industry): PlayedTable {
    return played(table, [
        createAction(InvestInIndustry, { ...envelope(table, onTheClock(table)), industry })
    ])
}

export function layNothing(table: PlayedTable): PlayedTable {
    return played(table, [
        createAction(LayTrack, { ...envelope(table, onTheClock(table)), placements: [] })
    ])
}

export function openSessionOn(table: PlayedTable): RailheadsGameSession {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: (table.game ?? GAME).id
    })
    const session = new RailheadsGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: RailheadsUiRuntime,
        game: table.game ?? GAME,
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
