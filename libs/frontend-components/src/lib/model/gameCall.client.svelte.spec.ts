import { tick } from 'svelte'
import { describe, expect, it } from 'vitest'
import { createStalledGameAction, GameCallKind, type Game, type GameAction } from '@tabletop/common'
import {
    createNoteGame,
    noteGameInfo,
    noteGameRuntime,
    step,
    type HydratedNoteGameState,
    type NoteGameState
} from '@tabletop/common/test-fixtures/note-game'
import { GameSession } from './gameSession.svelte.js'
import { BridgedContext } from '../services/bridges/bridgedContext.svelte.js'
import { HarnessAuthorizationService } from '../harness/harnessAuthorizationService.svelte.js'
import { HarnessLibraryService } from '../harness/harnessLibraryService.js'
import { HarnessGameService } from '../harness/harnessGameService.svelte.js'
import { HarnessChatService } from '../harness/harnessChatService.svelte.js'
import { DummyNotificationService } from '../harness/dummyNotificationService.js'
import { DummyRemoteApiService } from '../harness/dummyRemoteApiService.js'
import { DefaultColorizer } from '../definition/gameColorizer.js'
import type { GameUIRuntime } from '../definition/gameUiDefinition.js'

const uiRuntime = {
    ...noteGameRuntime,
    sessionClass: GameSession,
    colorizer: new DefaultColorizer(),
    gameUI: {
        load: async () => {
            throw Error('Session test does not render a table')
        },
        mount: () => {
            throw Error('Session test does not render a table')
        }
    }
} satisfies GameUIRuntime<NoteGameState, HydratedNoteGameState>

type Recorded = { game: Game; state: NoteGameState; actions: GameAction[] }

function record(endWithStall: boolean): Recorded {
    const { game, state, engine } = createNoteGame()
    let current = state
    const actions: GameAction[] = []
    const play = (action: GameAction) => {
        const result = engine.executeCanonicalAction({
            game,
            state: current,
            action: { ...action, index: current.actionCount }
        })
        current = result.updatedState
        actions.push(...result.processedActions)
    }
    play(step('s1', game.id, 'p1'))
    if (endWithStall) {
        play(createStalledGameAction({ gameId: game.id }))
        game.call = { kind: GameCallKind.Stalled }
    }
    return { game, state: current, actions }
}

// The site opens a game with its state and no actions, and loads its history afterwards.
function session({ game, state, actions }: Recorded, historyComplete: boolean) {
    const authorization = new HarnessAuthorizationService()
    const library = new HarnessLibraryService({
        info: { ...noteGameInfo, thumbnailUrl: '' },
        runtime: async () => uiRuntime
    })
    const gameService = new HarnessGameService(library, authorization)
    const chatService = new HarnessChatService()
    const bridge = new BridgedContext({
        authorizationService: authorization,
        gameService,
        chatService,
        gameId: game.id
    })
    const opened = new GameSession<NoteGameState, HydratedNoteGameState>({
        gameService,
        chatService,
        notificationService: new DummyNotificationService(),
        api: new DummyRemoteApiService(),
        bridgedContext: bridge,
        runtime: uiRuntime,
        game: structuredClone(game),
        state: structuredClone(state),
        actions: historyComplete ? structuredClone(actions) : [],
        historyComplete
    })
    return {
        session: opened,
        dispose() {
            opened.dispose()
            bridge.dispose()
        }
    }
}

async function settle(opened: GameSession<NoteGameState, HydratedNoteGameState>) {
    await tick()
    await opened.waitForVisibleTransitionSettled()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    await tick()
}

describe('GameSession gameCall', () => {
    it('is the recorded call when a called game opens before its history', async () => {
        const { session: opened, dispose } = session(record(true), false)
        try {
            await tick()
            expect(opened.gameCall).toEqual({ kind: GameCallKind.Stalled })
        } finally {
            dispose()
        }
    })

    it('is the call Action behind the state when the history is loaded', async () => {
        const { session: opened, dispose } = session(record(true), true)
        try {
            await tick()
            expect(opened.gameCall).toEqual({ kind: GameCallKind.Stalled })
        } finally {
            dispose()
        }
    })

    it('is nothing at the start of a called game viewed in history', async () => {
        const { session: opened, dispose } = session(record(true), true)
        try {
            await tick()
            await settle(opened)
            await opened.history.goToBeginning()
            await settle(opened)
            expect(opened.gameState.actionCount).toBe(0)
            expect(opened.gameCall).toBeUndefined()
        } finally {
            dispose()
        }
    })

    it('is nothing for a game still playing that opens before its history', async () => {
        const { session: opened, dispose } = session(record(false), false)
        try {
            await tick()
            expect(opened.gameCall).toBeUndefined()
        } finally {
            dispose()
        }
    })
})
