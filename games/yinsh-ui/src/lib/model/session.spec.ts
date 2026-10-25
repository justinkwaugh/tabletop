import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushSync } from 'svelte'
import { GameStorage, type Game, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    pointFromName,
    YinshRuntime,
    type HydratedYinshGameState,
    type YinshGameState
} from '@tabletop/yinsh'
import { YinshGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { YinshGameSession } from './session.svelte.js'

const HARNESS_USER = 'harness-user'
const ALICE = 'player-1'

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}

const runtime: GameUIRuntime<YinshGameState, HydratedYinshGameState> = {
    ...YinshRuntime,
    sessionClass: YinshGameSession,
    colorizer: new YinshGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...YinshRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const SCENARIOS = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

// The harness's Form a row: Alice (white, the harness user) to move. Her ring on F3 moving to G3
// completes a row of five white markers from F3 to B3.
function formARow() {
    const scenario = JSON.parse(readFileSync(join(SCENARIOS, 'form-a-row.json'), 'utf8'))
    const game: Game = {
        ...scenario.game,
        storage: GameStorage.Local,
        players: scenario.game.players.map((player: { id: string }) => ({
            ...player,
            userId: player.id === ALICE ? HARNESS_USER : 'someone-else'
        }))
    }
    return { game, state: scenario.state as YinshGameState, actions: [] }
}

const F3 = pointFromName('F3')
const G3 = pointFromName('G3')
const C6 = pointFromName('C6')

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

async function aliceSession() {
    const { game, state, actions } = formARow()
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new YinshGameSession({
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

// A move or Undo has landed once the session has shown the state it leads to and history has let
// go of the step, on a timer.
let current: YinshGameSession
async function settled(change: Promise<unknown>) {
    await change
    await current.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

describe('Choosing a ring to move', () => {
    it('stages the ring, and Undo puts it down without undoing any action', async () => {
        const session = await aliceSession()
        await session.choosePoint(F3)
        expect(session.chosenFrom).toEqual(F3)
        expect(session.destinations.length).toBeGreaterThan(0)

        await settled(session.undo())
        expect(session.chosenFrom).toBeUndefined()
        expect(session.hasManualSelection()).toBe(false)
        expect(session.gameState.actionCount).toBe(0)
    })

    it('puts the ring down when it is chosen again, and takes another in its place', async () => {
        const session = await aliceSession()
        await session.choosePoint(F3)
        await session.choosePoint(F3)
        expect(session.chosenFrom).toBeUndefined()

        await session.choosePoint(F3)
        await session.choosePoint(C6)
        expect(session.chosenFrom).toEqual(C6)
    })
})

describe('Undo of a move', () => {
    it('takes the move back with its ring chosen again, the marker still in it', async () => {
        const session = await aliceSession()
        await session.choosePoint(F3)
        await settled(session.choosePoint(G3))
        expect(session.gameState.actionCount).toBe(1)
        expect(session.selection).toEqual({})
        expect(session.rowOptions.markers.length).toBeGreaterThan(0)

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(0)
        expect(session.gameState.board.ringsOf(ALICE)).toContainEqual(F3)
        expect(session.chosenFrom).toEqual(F3)
        expect(session.restaged).toBe(true)
        expect(session.hasManualSelection()).toBe(true)
    })

    it('then puts the ring down, lifting its marker out, without undoing any action', async () => {
        const session = await aliceSession()
        await session.choosePoint(F3)
        await settled(session.choosePoint(G3))
        await settled(session.undo())

        await settled(session.undo())
        expect(session.chosenFrom).toBeUndefined()
        expect(session.lifting).toEqual(F3)
        expect(session.gameState.actionCount).toBe(0)
        expect(session.hasManualSelection()).toBe(false)
    })

    it('drops the marker in afresh when the ring is chosen again by hand', async () => {
        const session = await aliceSession()
        await session.choosePoint(F3)
        await settled(session.choosePoint(G3))
        await settled(session.undo())
        await settled(session.undo())

        await session.choosePoint(F3)
        expect(session.chosenFrom).toEqual(F3)
        expect(session.restaged).toBe(false)
        expect(session.lifting).toBeUndefined()
    })
})

describe('Stepping through history', () => {
    it('offers nothing to choose while viewing an earlier position', async () => {
        const session = await aliceSession()
        await session.choosePoint(F3)
        await settled(session.choosePoint(G3))

        await settled(session.history.goToPreviousAction())
        expect(session.isViewingHistory).toBe(true)
        expect(session.movable).toEqual([])
        expect(session.rowOptions.markers).toEqual([])
        expect(session.isClickable(F3)).toBe(false)
    })
})
