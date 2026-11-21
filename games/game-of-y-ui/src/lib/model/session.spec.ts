import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushSync } from 'svelte'
import {
    Color,
    GameStorage,
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
import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { BoardShape, YRuntime, type HydratedYGameState, type YGameState } from '@tabletop/game-of-y'
import { YGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { YGameSession } from './session.svelte.js'

const HARNESS_USER = 'harness-user'
const BOB = 'player-2'

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}

const runtime: GameUIRuntime<YGameState, HydratedYGameState> = {
    ...YRuntime,
    sessionClass: YGameSession,
    colorizer: new YGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...YRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const SCENARIOS = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

// The harness's Swap or place: Alice's first stone is on E5 and Bob, White and the harness user,
// is to play, with the swap rule on. `shape` moves the same position to another board.
function swapOrPlace(shape: BoardShape) {
    const scenario = JSON.parse(readFileSync(join(SCENARIOS, 'swap-or-place.json'), 'utf8'))
    const game: Game = {
        ...scenario.game,
        storage: GameStorage.Local,
        config: { ...scenario.game.config, board: shape },
        players: scenario.game.players.map((player: { id: string }) => ({
            ...player,
            userId: player.id === BOB ? HARNESS_USER : 'someone-else'
        }))
    }
    const state: YGameState = { ...scenario.state, board: { ...scenario.state.board, shape } }
    const actions: GameAction[] = scenario.actions
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

let current: YGameSession

async function bobSession(shape = BoardShape.Kadon) {
    const { game, state, actions } = swapOrPlace(shape)
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new YGameSession({
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
async function settled(change: Promise<unknown>) {
    await change
    await current.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

describe('Placing a stone', () => {
    it('places on an empty point and hands the turn on', async () => {
        const session = await bobSession()
        expect(session.placeable.has('E5')).toBe(false)
        expect(session.placeable.has('F5')).toBe(true)
        await settled(session.placeStone('F5'))
        expect(session.gameState.board.stoneAt('F5')?.color).toBe(Color.White)
        expect(session.isMyTurn).toBe(false)
        expect(session.canPlace).toBe(false)
    })

    it('ignores a taken point, a name off the board and taps while a move plays', async () => {
        const session = await bobSession()
        await session.placeStone('E5')
        await session.placeStone('Z9')
        session.updatingVisibleState = true
        await session.placeStone('F5')
        session.updatingVisibleState = false
        expect(session.gameState.board.stones).toHaveLength(1)
        expect(session.isMyTurn).toBe(true)
    })

    it('offers nothing while history is viewed', async () => {
        const session = await bobSession()
        await settled(session.placeStone('F5'))
        session.setViewingAsNonActivePlayer(true)
        await settled(session.history.goToPreviousAction())
        expect(session.isViewingHistory).toBe(true)
        expect(session.canPlace).toBe(false)
        expect(session.canSwap).toBe(false)
        expect(session.placeable.size).toBe(0)
    })
})

describe('The swap', () => {
    it("lets White take Black's first stone, and Undo takes the swap back", async () => {
        const session = await bobSession()
        expect(session.canSwap).toBe(true)
        await settled(session.swapColors())
        expect(session.colorOf(BOB)).toBe(Color.Black)
        expect(session.gameState.board.stoneAt('E5')?.color).toBe(Color.Black)
        expect(session.canSwap).toBe(false)

        await settled(session.undo())
        expect(session.colorOf(BOB)).toBe(Color.White)
        expect(session.canSwap).toBe(true)
    })

    it('closes once White places instead', async () => {
        const session = await bobSession()
        await settled(session.placeStone('F5'))
        expect(session.canSwap).toBe(false)
    })
})

describe('Hex boards', () => {
    it('place in cells named as on a Hex board, and call them cells', async () => {
        const session = await bobSession(BoardShape.Hex9)
        expect(session.isHexBoard).toBe(true)
        expect(session.placeWord).toBe('cell')
        expect(session.placeable.size).toBe(44)
        expect(session.placeable.has('J2')).toBe(false)
        await settled(session.placeStone('A9'))
        expect(session.gameState.board.stoneAt('A9')?.color).toBe(Color.White)
    })

    it("are not Kadon's board, whose places are points", async () => {
        const session = await bobSession()
        expect(session.isHexBoard).toBe(false)
        expect(session.placeWord).toBe('point')
        expect(session.placeable.size).toBe(92)
    })
})
