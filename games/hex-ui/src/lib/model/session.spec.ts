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
import { BoardSize, HexRuntime, type HydratedHexGameState, type HexGameState } from '@tabletop/hex'
import { HexGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { HexGameSession } from './session.svelte.js'

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

const runtime: GameUIRuntime<HexGameState, HydratedHexGameState> = {
    ...HexRuntime,
    sessionClass: HexGameSession,
    colorizer: new HexGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return { ...HexRuntime, sessionClass: GameSession, colorizer: runtime.colorizer, gameUI }
    }
}

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const SCENARIOS = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

// The harness's Swap or place: Alice has filled F6 and Bob, Blue and the harness user, is to
// play, with the swap rule on. `size` moves the same position to another board.
function swapOrPlace(size: BoardSize) {
    const scenario = JSON.parse(readFileSync(join(SCENARIOS, 'swap-or-place.json'), 'utf8'))
    const game: Game = {
        ...scenario.game,
        storage: GameStorage.Local,
        config: { ...scenario.game.config, size },
        players: scenario.game.players.map((player: { id: string }) => ({
            ...player,
            userId: player.id === BOB ? HARNESS_USER : 'someone-else'
        }))
    }
    const state: HexGameState = { ...scenario.state, board: { ...scenario.state.board, size } }
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

let current: HexGameSession

async function bobSession(size = BoardSize.Eleven) {
    const { game, state, actions } = swapOrPlace(size)
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new HexGameSession({
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

describe('Filling a cell', () => {
    it('fills an empty cell and hands the turn on', async () => {
        const session = await bobSession()
        expect(session.placeable.has('F6')).toBe(false)
        expect(session.placeable.has('G5')).toBe(true)
        expect(session.placeable.size).toBe(120)
        await settled(session.placeStone('G5'))
        expect(session.gameState.board.stoneAt('G5')?.color).toBe(Color.Blue)
        expect(session.isMyTurn).toBe(false)
        expect(session.canPlace).toBe(false)
    })

    it('ignores a taken cell, a name off the board and taps while a move plays', async () => {
        const session = await bobSession()
        await session.placeStone('F6')
        await session.placeStone('L1')
        session.updatingVisibleState = true
        await session.placeStone('G5')
        session.updatingVisibleState = false
        expect(session.gameState.board.stones).toHaveLength(1)
        expect(session.isMyTurn).toBe(true)
    })

    it('offers nothing while history is viewed', async () => {
        const session = await bobSession()
        await settled(session.placeStone('G5'))
        session.setViewingAsNonActivePlayer(true)
        await settled(session.history.goToPreviousAction())
        expect(session.isViewingHistory).toBe(true)
        expect(session.canPlace).toBe(false)
        expect(session.canSwap).toBe(false)
        expect(session.placeable.size).toBe(0)
    })

    it('offers every cell of the board chosen', async () => {
        const session = await bobSession(BoardSize.Nineteen)
        expect(session.placeable.size).toBe(19 * 19 - 1)
        expect(session.placeable.has('S19')).toBe(true)
        expect(session.placeable.has('T1')).toBe(false)
    })
})

describe('The swap', () => {
    it("lets Blue take Red's first stone, and Undo takes the swap back", async () => {
        const session = await bobSession()
        expect(session.canSwap).toBe(true)
        await settled(session.swapColors())
        expect(session.colorOf(BOB)).toBe(Color.Red)
        expect(session.gameState.board.stoneAt('F6')?.color).toBe(Color.Red)
        expect(session.canSwap).toBe(false)

        await settled(session.undo())
        expect(session.colorOf(BOB)).toBe(Color.Blue)
        expect(session.canSwap).toBe(true)
    })

    it('closes once Blue places instead', async () => {
        const session = await bobSession()
        await settled(session.placeStone('G5'))
        expect(session.canSwap).toBe(false)
    })
})
