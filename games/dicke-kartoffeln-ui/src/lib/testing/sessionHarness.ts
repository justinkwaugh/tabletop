import { flushSync } from 'svelte'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
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
    DickeKartoffelnRuntime,
    SubmitPlan,
    emptyPlan,
    isPlanningState,
    planKindFor,
    type DickeKartoffelnProjectedState,
    type Plan
} from '@tabletop/dicke-kartoffeln'
import { UiDefinition } from '$lib/definitions/definition.js'
import { DickeKartoffelnUiRuntime } from '$lib/definitions/runtime.js'
import { DickeKartoffelnGameSession } from '$lib/model/session.svelte.js'

const HARNESS_DEFINITION: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...DickeKartoffelnRuntime,
            sessionClass: GameSession,
            colorizer: DickeKartoffelnUiRuntime.colorizer,
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

const engine = new GameEngine(DickeKartoffelnRuntime)
const open: DickeKartoffelnGameSession[] = []

export const SEATS = ['p1', 'p2', 'p3']

const GAME: Game = {
    ...DickeKartoffelnRuntime.initializer.initializeGame(
        {
            id: 'dicke-kartoffeln-session',
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

export type PlayedTable = { state: DickeKartoffelnProjectedState; actions: GameAction[] }

export function startingTable(): PlayedTable {
    const { initialState } = engine.startGame(GAME, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: SEATS }
    })
    return { state: initialState, actions: [] }
}

export function submit(table: PlayedTable, playerId: string, plan: Plan): PlayedTable {
    const action = createAction(SubmitPlan, {
        id: `a-${table.state.actionCount}`,
        index: table.state.actionCount,
        gameId: table.state.gameId,
        source: ActionSource.User,
        playerId,
        plan,
        simultaneousGroupId: `${table.state.years.series.length}-${table.state.machineState}`
    })
    const result = engine.executeAction({ action, state: table.state, game: GAME })
    return { state: result.updatedState, actions: [...table.actions, ...result.processedActions] }
}

type PlanChooser = (table: PlayedTable, playerId: string) => Plan | undefined

export function playUntil(
    table: PlayedTable,
    until: (table: PlayedTable) => boolean,
    choose: PlanChooser = () => undefined
): PlayedTable {
    let played = table
    while (!until(played)) {
        const round = played.state.machineState
        const [playerId] = played.state.activePlayerIds
        if (!isPlanningState(round) || !playerId) {
            throw Error(`Nobody can play on in ${round}`)
        }
        played = submit(played, playerId, choose(played, playerId) ?? emptyPlan(planKindFor(round)))
    }
    return played
}

export function openSessionOn(table: PlayedTable): DickeKartoffelnGameSession {
    const appContext = createHarnessAppContext(HARNESS_DEFINITION)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: GAME.id
    })
    const session = new DickeKartoffelnGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: DickeKartoffelnUiRuntime,
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
