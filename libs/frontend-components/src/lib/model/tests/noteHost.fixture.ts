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
    noteGameRuntime,
    type NoteGameState
} from '@tabletop/common/test-fixtures/note-game'
import { HarnessAuthorizationService } from '../../harness/harnessAuthorizationService.svelte.js'
import { DummyRemoteApiService } from '../../harness/dummyRemoteApiService.js'
import { openNoteSession } from './noteGameSession.fixture.js'

// The host's side of a submission: like the backend, a replacement reverses history back through
// the declaration it names, redoes what followed and is then appended (ADR 0008).
export class NoteHost {
    readonly engine: ReturnType<typeof createNoteGame>['engine'] = createNoteGame().engine
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
export function hostedSession(host: NoteHost, viewer: { playerId: string } | 'admin') {
    return openNoteSession({
        game: host.game,
        state: host.state,
        actions: host.actions,
        api: new Remote(host),
        authorization:
            viewer === 'admin'
                ? new Authorization('admin', true)
                : new Authorization(viewer.playerId, false)
    })
}
