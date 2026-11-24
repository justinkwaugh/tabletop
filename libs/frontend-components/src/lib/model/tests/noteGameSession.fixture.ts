import type { Game, GameAction } from '@tabletop/common'
import {
    noteGameInfo,
    noteGameRuntime,
    type HydratedNoteGameState,
    type NoteGameState
} from '@tabletop/common/test-fixtures/note-game'
import { GameSession } from '../gameSession.svelte.js'
import { BridgedContext } from '../../services/bridges/bridgedContext.svelte.js'
import { HarnessAuthorizationService } from '../../harness/harnessAuthorizationService.svelte.js'
import { HarnessLibraryService } from '../../harness/harnessLibraryService.js'
import { HarnessGameService } from '../../harness/harnessGameService.svelte.js'
import { HarnessChatService } from '../../harness/harnessChatService.svelte.js'
import { DummyNotificationService } from '../../harness/dummyNotificationService.js'
import { DummyRemoteApiService } from '../../harness/dummyRemoteApiService.js'
import { DefaultColorizer } from '../../definition/gameColorizer.js'
import type { GameUIRuntime } from '../../definition/gameUiDefinition.js'
import type { RemoteApiService } from '../../services/remoteApiService.js'

const noteUiRuntime = {
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

export function openNoteSession({
    game,
    state,
    actions,
    historyComplete = true,
    api = new DummyRemoteApiService(),
    authorization = new HarnessAuthorizationService()
}: {
    game: Game
    state: NoteGameState
    actions: GameAction[]
    historyComplete?: boolean
    api?: RemoteApiService
    authorization?: HarnessAuthorizationService
}): { session: GameSession<NoteGameState, HydratedNoteGameState>; dispose(): void } {
    const library = new HarnessLibraryService({
        info: { ...noteGameInfo, thumbnailUrl: '' },
        runtime: async () => noteUiRuntime
    })
    const gameService = new HarnessGameService(library, authorization)
    const chatService = new HarnessChatService()
    const bridge = new BridgedContext({
        authorizationService: authorization,
        gameService,
        chatService,
        gameId: game.id
    })
    const session = new GameSession<NoteGameState, HydratedNoteGameState>({
        gameService,
        chatService,
        notificationService: new DummyNotificationService(),
        api,
        bridgedContext: bridge,
        runtime: noteUiRuntime,
        game: structuredClone(game),
        state: structuredClone(state),
        actions: structuredClone(actions),
        historyComplete
    })
    return {
        session,
        dispose() {
            session.dispose()
            bridge.dispose()
        }
    }
}
