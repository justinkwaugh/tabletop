import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    GameStorage,
    PlayerStatus,
    type AxialCoordinates,
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
import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    ActionType,
    Definition,
    GipfInfo,
    GipfRuntime,
    GipfVersion,
    type GipfGameState,
    type HydratedGipfGameState,
    type PushPiece
} from '@tabletop/gipf'
import { GipfGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { GipfGameSession } from './session.svelte.js'

const engine = new GameEngine(GipfRuntime)
const WHITE = 'white'
const BLACK = 'black'
const HARNESS_USER = 'harness-user'

const E1: AxialCoordinates = { q: 0, r: 4 }
const E2: AxialCoordinates = { q: 0, r: 3 }
const E8: AxialCoordinates = { q: 0, r: -3 }
const E9: AxialCoordinates = { q: 0, r: -4 }

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}

const runtime: GameUIRuntime<GipfGameState, HydratedGipfGameState> = {
    ...GipfRuntime,
    sessionClass: GipfGameSession,
    colorizer: new GipfGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...GipfRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

let actionCount = 0
function push(playerId: string, dot: AxialCoordinates, to: AxialCoordinates, gipf: boolean) {
    actionCount += 1
    return {
        id: `push-${actionCount}`,
        gameId: 'gipf-session',
        source: ActionSource.User,
        playerId,
        type: ActionType.PushPiece,
        dot,
        to,
        gipf
    } satisfies PushPiece
}

// A Tournament game of white, the harness user, against black. After the opening each has brought
// in a GIPF-piece, so white may choose either piece type; before it, white must bring one in.
function tournament(opening: boolean) {
    const game = GipfRuntime.initializer.initializeGame(
        {
            id: 'gipf-session',
            typeId: 'gipf',
            ownerId: HARNESS_USER,
            storage: GameStorage.Local,
            seed: 5,
            config: {
                ...defaultGameConfig(GipfInfo.configurator?.options ?? []),
                version: GipfVersion.Tournament
            },
            players: [WHITE, BLACK].map((id) => ({
                id,
                name: id,
                userId: id === WHITE ? HARNESS_USER : 'someone-else',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    let state: GipfGameState = engine.startGame(game, {
        startingPositions: { playerIds: [WHITE, BLACK] }
    }).initialState
    const actions: GameAction[] = []
    const openingPushes = opening ? [push(WHITE, E9, E8, true), push(BLACK, E1, E2, true)] : []
    for (const action of openingPushes) {
        const result = engine.executeAction({ action, state, game })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    return { game, state, actions }
}

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

async function whiteSession(opening = true) {
    const { game, state, actions } = tournament(opening)
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new GipfGameSession({
        gameService: app.gameService,
        bridgedContext,
        notificationService: app.notificationService,
        chatService: app.chatService,
        api: app.api,
        runtime,
        game,
        state,
        actions
    })
    disposals.push(() => {
        session.dispose()
        bridgedContext.dispose()
    })
    flushSync()
    current = session
    // The session presents its first state before it takes any action.
    await session.waitForVisibleTransitionSettled()
    return session
}

// White brings a single piece in from E9 to E8, under its GIPF-piece.
const DOT = E9
const TARGET = E8

async function pushOwn(session: GipfGameSession, gipf = false) {
    session.chooseDot(DOT)
    if (gipf) session.toggleGipf()
    await settled(session.push(TARGET))
}

// A move, Undo or history step has landed once the session has shown the state it leads to and
// history has let go of the step, on a timer.
let current: GipfGameSession
async function settled(change: Promise<unknown>) {
    await change
    await current.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

describe('Undo of your push', () => {
    it('takes the piece back out onto its dot, staged as you chose it', async () => {
        const session = await whiteSession()
        await pushOwn(session)
        expect(session.selection).toEqual({})

        await settled(session.undo())

        expect(session.gameState.actionCount).toBe(2)
        expect(session.chosenGipf).toBe(false)
        expect(session.chosenDot).toEqual(DOT)
    })

    it('then takes back one choice at a time, without undoing any action', async () => {
        const session = await whiteSession()
        await pushOwn(session, true)
        await settled(session.undo())
        expect(session.chosenGipf).toBe(true)

        await settled(session.undo())
        expect(session.chosenDot).toEqual(DOT)
        expect(session.chosenGipf).toBe(false)

        await settled(session.undo())
        expect(session.hasManualSelection()).toBe(false)
        expect(session.gameState.actionCount).toBe(2)
    })

    it('stages only the dot when there was no piece type to choose', async () => {
        const session = await whiteSession(false)
        expect(session.pieceTypes).toEqual([true])
        session.chooseDot(DOT)
        await settled(session.push(TARGET))

        await settled(session.undo())
        expect(session.selection).toEqual({ dot: { value: DOT, source: 'manual' } })
        expect(session.chosenGipf).toBe(true)

        await settled(session.undo())
        expect(session.hasManualSelection()).toBe(false)
        expect(session.gameState.actionCount).toBe(0)
    })
})

describe('Choosing the piece type', () => {
    it('drops a single piece, which choosing again makes a GIPF-piece, then single again', async () => {
        const session = await whiteSession()
        expect(session.choosesType).toBe(true)
        expect(session.chosenGipf).toBe(false)

        session.chooseDot(DOT)
        expect(session.chosenGipf).toBe(false)
        session.chooseDot(DOT)
        expect(session.chosenGipf).toBe(true)
        expect(session.chosenDot).toEqual(DOT)
        session.toggleGipf()
        expect(session.chosenGipf).toBe(false)
        expect(session.chosenDot).toEqual(DOT)
    })

    it('takes the piece off its dot when there is no type to choose', async () => {
        const session = await whiteSession(false)
        session.chooseDot(DOT)
        session.chooseDot(DOT)
        expect(session.chosenDot).toBeUndefined()
    })
})

describe('Stepping through history', () => {
    it('records the push stepped to, which names the dot its piece came in from', async () => {
        const session = await whiteSession()
        await settled(session.history.goToPreviousAction())
        expect(session.historyPush).toMatchObject({ playerId: WHITE, dot: E9, to: E8 })

        await settled(session.history.goToNextAction())
        expect(session.historyPush).toMatchObject({ playerId: BLACK, dot: E1, to: E2 })
    })
})
