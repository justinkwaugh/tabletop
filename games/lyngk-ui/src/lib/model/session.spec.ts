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
import { LyngkRuntime, type HydratedLyngkGameState, type LyngkGameState } from '@tabletop/lyngk'
import { LyngkGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { LyngkGameSession } from './session.svelte.js'

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

const runtime: GameUIRuntime<LyngkGameState, HydratedLyngkGameState> = {
    ...LyngkRuntime,
    sessionClass: LyngkGameSession,
    colorizer: new LyngkGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...LyngkRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const SCENARIOS = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

// The harness's LYNGK chain: Alice (the harness user) to move. Her green on -1,1 can land on
// three points; the black on 0,-3 only on 1,-3.
function lyngkChain() {
    const scenario = JSON.parse(readFileSync(join(SCENARIOS, 'lyngk-chain.json'), 'utf8'))
    const game: Game = {
        ...scenario.game,
        storage: GameStorage.Local,
        players: scenario.game.players.map((player: { id: string }) => ({
            ...player,
            userId: player.id === ALICE ? HARNESS_USER : 'someone-else'
        }))
    }
    return { game, state: scenario.state as LyngkGameState, actions: [] }
}

const GREEN = { q: -1, r: 1 }
const GREEN_LANDING = { q: 1, r: 1 }
const BLACK = { q: 0, r: -3 }
const BLACK_LANDING = { q: 1, r: -3 }

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

async function aliceSession({ hotseat = false } = {}) {
    const prepared = lyngkChain()
    const { state, actions } = prepared
    const game = { ...prepared.game, hotseat }
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new LyngkGameSession({
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
let current: LyngkGameSession
async function settled(change: Promise<unknown>) {
    await change
    await current.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

describe('Undo of a move', () => {
    it('takes the move back with its stack chosen again', async () => {
        const session = await aliceSession()
        await session.choosePoint(GREEN)
        await settled(session.choosePoint(GREEN_LANDING))
        expect(session.gameState.actionCount).toBe(1)
        expect(session.selection).toEqual({})

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(0)
        expect(session.gameState.board.piecesAt(GREEN).length).toBe(1)
        expect(session.chosenFrom).toEqual(GREEN)
        expect(session.landings).toContainEqual(GREEN_LANDING)
        expect(session.hasLocalSelection).toBe(true)
    })

    it('then puts the stack down without undoing any action', async () => {
        const session = await aliceSession()
        await session.choosePoint(GREEN)
        await settled(session.choosePoint(GREEN_LANDING))
        await settled(session.undo())

        await settled(session.undo())
        expect(session.chosenFrom).toBeUndefined()
        expect(session.gameState.actionCount).toBe(0)
        expect(session.hasLocalSelection).toBe(false)
    })

    it('leaves a stack with only the one landing put down', async () => {
        const session = await aliceSession()
        await session.choosePoint(BLACK)
        await settled(session.choosePoint(BLACK_LANDING))

        await settled(session.undo())
        expect(session.gameState.actionCount).toBe(0)
        expect(session.chosenFrom).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })

    it('chooses nothing when history steps back over the move', async () => {
        const session = await aliceSession()
        await session.choosePoint(GREEN)
        await settled(session.choosePoint(GREEN_LANDING))

        await settled(session.history.goToPreviousAction())
        expect(session.isViewingHistory).toBe(true)
        expect(session.chosenFrom).toBeUndefined()
        expect(session.movable).toEqual([])
    })

    it('finds the move a step back takes back among the actions', async () => {
        const session = await aliceSession()
        await session.choosePoint(GREEN)
        await settled(session.choosePoint(GREEN_LANDING))
        expect(session.undoneMove({ actionCount: 0 })?.to).toEqual(GREEN_LANDING)
        expect(session.undoneMove({ actionCount: 1 })).toBeUndefined()
    })
})

describe('A move playing', () => {
    it('ignores taps on its choices until the new state lands', async () => {
        const session = await aliceSession()
        session.updatingVisibleState = true
        await session.choosePoint(GREEN)
        expect(session.chosenFrom).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)

        session.updatingVisibleState = false
        await session.choosePoint(GREEN)
        expect(session.chosenFrom).toEqual(GREEN)
        session.updatingVisibleState = true
        session.letGo()
        expect(session.chosenFrom).toEqual(GREEN)
    })
})

describe('A choice belongs to its maker', () => {
    it("keeps a player's chosen stack from anyone else viewing, and back for them", async () => {
        const session = await aliceSession({ hotseat: true })
        await session.choosePoint(GREEN)
        expect(session.hasLocalSelection).toBe(true)

        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).not.toBe(ALICE)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.chosenFrom).toBeUndefined()

        session.setViewingAsNonActivePlayer(false)
        expect(session.chosenFrom).toEqual(GREEN)
    })

    it('restages only the move the Undo takes back, and only for its maker', async () => {
        const session = await aliceSession({ hotseat: true })
        await session.choosePoint(GREEN)
        await settled(session.choosePoint(GREEN_LANDING))
        const [move] = session.actions
        session.willUndo(move)
        expect(session.restagedMove({ actionCount: 0 })).toBeDefined()
        // An Undo landing on another count takes back some other action.
        expect(session.restagedMove({ actionCount: 1 })).toBeUndefined()

        session.setViewingAsNonActivePlayer(true)
        expect(session.restagedMove({ actionCount: 0 })).toBeUndefined()
    })
})
