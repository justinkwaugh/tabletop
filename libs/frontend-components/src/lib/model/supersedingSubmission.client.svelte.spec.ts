import { tick } from 'svelte'
import { describe, expect, it } from 'vitest'
import {
    GameStorage,
    GameSyncStatus,
    Role,
    UserStatus,
    calculateActionChecksum,
    replaceSupersededAction,
    type Game,
    type GameAction
} from '@tabletop/common'
import {
    createNoteGame,
    note,
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

// The host's side of a submission: like the backend, a replacement reverses history back through
// the declaration it names, redoes what followed and is then appended (ADR 0008).
class NoteHost {
    readonly engine = createNoteGame().engine
    game: Game
    state: NoteGameState
    actions: GameAction[] = []

    constructor() {
        const { game, state } = createNoteGame()
        this.game = { ...game, storage: GameStorage.Remote }
        this.state = state
    }

    apply(action: GameAction): GameAction[] {
        if (action.supersedesActionId !== undefined) {
            const position = this.actions.findIndex((a) => a.id === action.supersedesActionId)
            const outcome = replaceSupersededAction({
                engine: this.engine,
                apiActions: noteGameRuntime.apiActions,
                game: this.game,
                state: this.state,
                window: this.actions.slice(position),
                replacement: action
            })
            if (outcome.kind !== 'replace') throw Error(outcome.reason)
            this.actions = [...this.actions.slice(0, position), ...outcome.redone]
            this.state = outcome.state
        }
        const result = this.engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action: { ...action, index: this.state.actionCount }
        })
        this.state = result.updatedState
        this.actions.push(...result.processedActions)
        this.game = { ...this.game, activePlayerIds: [...this.state.activePlayerIds] }
        return result.processedActions
    }
}

class Remote extends DummyRemoteApiService {
    constructor(private readonly host: NoteHost) {
        super()
    }
    async getGame() {
        return {
            game: { ...structuredClone(this.host.game), state: structuredClone(this.host.state) },
            actions: structuredClone(this.host.actions)
        }
    }
    async checkSync(_gameId: string, checksum: number, index: number) {
        const later = this.host.actions.slice(index + 1)
        const inSync = calculateActionChecksum(checksum, later) === this.host.state.actionChecksum
        return {
            status: inSync ? GameSyncStatus.InSync : GameSyncStatus.OutOfSync,
            checksum: this.host.state.actionChecksum,
            actions: structuredClone(
                inSync ? later : this.host.actions.slice(Math.max(index - 10, 0))
            )
        }
    }
    async applyAction(_game: Game, action: GameAction) {
        const processed = this.host.apply(structuredClone(action))
        return { game: structuredClone(this.host.game), actions: structuredClone(processed) }
    }
}

class Authorization extends HarnessAuthorizationService {
    constructor(
        private readonly userId: string,
        admin: boolean
    ) {
        super()
        this.isAdmin = admin
        this.adminCapabilitiesEnabled = admin
    }
    getSessionUser() {
        return {
            id: this.userId,
            roles: this.isAdmin ? [Role.User, Role.Admin] : [Role.User],
            status: UserStatus.Active,
            externalIds: []
        }
    }
}

// An Administrator acting in a game they do not play acts for its single active Player.
function hostedSession(host: NoteHost, viewer: { playerId: string } | 'admin') {
    const authorization =
        viewer === 'admin'
            ? new Authorization('admin', true)
            : new Authorization(viewer.playerId, false)
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
        gameId: host.game.id
    })
    const session = new GameSession<NoteGameState, HydratedNoteGameState>({
        gameService,
        chatService,
        notificationService: new DummyNotificationService(),
        api: new Remote(host),
        bridgedContext: bridge,
        runtime: uiRuntime,
        game: structuredClone(host.game),
        state: structuredClone(host.state),
        actions: structuredClone(host.actions)
    })
    return {
        session,
        dispose() {
            session.dispose()
            bridge.dispose()
        }
    }
}

async function settle(session: GameSession<NoteGameState, HydratedNoteGameState>) {
    await tick()
    await session.waitForVisibleTransitionSettled()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    await tick()
}

const ids = (actions: readonly GameAction[]) => actions.map((action) => action.id)

describe('A hosted Player replacing a standing declaration', () => {
    it('ends with the host’s history when other Actions followed the declaration', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(note('n1', gameId, 'p3', 'first'))
        host.apply(step('s2', gameId, 'p2'))
        const { session, dispose } = hostedSession(host, { playerId: 'p3' })
        try {
            await settle(session)
            expect(session.busy).toBe(false)
            const replacement = session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            expect(replacement.supersedesActionId).toBe('n1')

            await session.applyAction(replacement)
            await settle(session)

            expect(ids(host.actions)).toEqual(['s1', 's2', 'n2'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            const state = session.gameState
            expect(state.steps).toEqual(['p1', 'p2'])
            expect(state.notes).toEqual({ p3: 'second' })
            expect(state.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })

    it('ends with the host’s history when an Administrator acts for the Player', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(note('n1', gameId, 'p3', 'first'))
        host.apply(step('s2', gameId, 'p2'))
        const { session, dispose } = hostedSession(host, 'admin')
        try {
            await settle(session)
            expect(session.myPlayer?.id).toBe('p3')
            await session.applyAction(
                session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            )
            await settle(session)

            expect(ids(host.actions)).toEqual(['s1', 's2', 'n2'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            expect(session.gameState.notes).toEqual({ p3: 'second' })
            expect(session.gameState.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })

    it('ends with the host’s history when it replaces the last Action', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(note('n1', gameId, 'p3', 'first'))
        const { session, dispose } = hostedSession(host, { playerId: 'p3' })
        try {
            await settle(session)
            await session.applyAction(
                session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            )
            await settle(session)

            expect(ids(host.actions)).toEqual(['s1', 'n2'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            expect(session.gameState.notes).toEqual({ p3: 'second' })
            expect(session.gameState.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })

    it('ends with the host’s history when the declaration is older than a sync check reaches', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(note('n1', gameId, 'p3', 'first'))
        for (let turn = 0; turn < 14; turn++)
            host.apply(step(`s${turn}`, gameId, host.state.activePlayerIds[0]))
        const { session, dispose } = hostedSession(host, { playerId: 'p3' })
        try {
            await settle(session)
            await session.applyAction(
                session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            )
            await settle(session)

            expect(ids(host.actions).slice(0, 2)).toEqual(['s0', 's1'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            expect(session.gameState.notes).toEqual({ p3: 'second' })
            expect(session.gameState.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })
})
