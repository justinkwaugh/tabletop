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
    spaceFromName,
    TzaarRuntime,
    type HydratedTzaarGameState,
    type TzaarGameState
} from '@tabletop/tzaar'
import { TzaarGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { TzaarGameSession } from './session.svelte.js'

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

const runtime: GameUIRuntime<TzaarGameState, HydratedTzaarGameState> = {
    ...TzaarRuntime,
    sessionClass: TzaarGameSession,
    colorizer: new TzaarGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...TzaarRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const SCENARIOS = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

// The harness's Two Tzaars left: Alice (White, the harness user) to capture. Her stack on D1
// captures Bob's Tzaar on D2.
function twoTzaarsLeft() {
    const scenario = JSON.parse(readFileSync(join(SCENARIOS, 'two-tzaars-left.json'), 'utf8'))
    const game: Game = {
        ...scenario.game,
        storage: GameStorage.Local,
        players: scenario.game.players.map((player: { id: string }) => ({
            ...player,
            userId: player.id === ALICE ? HARNESS_USER : 'someone-else'
        }))
    }
    return { game, state: scenario.state as TzaarGameState, actions: [] }
}

const D1 = spaceFromName('D1')
const D2 = spaceFromName('D2')

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

async function aliceSession() {
    const { game, state, actions } = twoTzaarsLeft()
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new TzaarGameSession({
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
let current: TzaarGameSession
async function settled(change: Promise<unknown>) {
    await change
    await current.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

describe('Undo of a move', () => {
    it('takes the move back with its stack chosen again', async () => {
        const session = await aliceSession()
        await session.chooseSpace(D1)
        await settled(session.chooseSpace(D2))
        expect(session.gameState.actionCount).toBe(1)
        expect(session.selection).toEqual({})
        expect(session.canPass).toBe(true)

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(0)
        expect(session.gameState.board.stackAt(D1).length).toBeGreaterThan(0)
        expect(session.chosenFrom).toEqual(D1)
        expect(session.captureTargets).toContainEqual(D2)
        expect(session.hasManualSelection()).toBe(true)
    })

    it('then puts the stack down without undoing any action', async () => {
        const session = await aliceSession()
        await session.chooseSpace(D1)
        await settled(session.chooseSpace(D2))
        await settled(session.undo())

        await settled(session.undo())
        expect(session.chosenFrom).toBeUndefined()
        expect(session.gameState.actionCount).toBe(0)
        expect(session.hasManualSelection()).toBe(false)
    })

    it('chooses nothing when history steps back over the move', async () => {
        const session = await aliceSession()
        await session.chooseSpace(D1)
        await settled(session.chooseSpace(D2))

        await settled(session.history.goToPreviousAction())
        expect(session.isViewingHistory).toBe(true)
        expect(session.chosenFrom).toBeUndefined()
        expect(session.isClickable(D1)).toBe(false)
    })
})

describe('the second move', () => {
    it('passes, ending Alice’s turn', async () => {
        const session = await aliceSession()
        await session.chooseSpace(D1)
        await settled(session.chooseSpace(D2))
        await settled(session.pass())
        expect(session.gameState.activePlayerIds).toEqual(['player-2'])
    })
})
