import { HarnessAuthorizationService } from './harnessAuthorizationService.svelte.js'
import { DummyNotificationService } from './dummyNotificationService.js'
import { HarnessChatService } from './harnessChatService.svelte.js'
import { HarnessGameService } from './harnessGameService.svelte.js'
import { HarnessLibraryService } from './harnessLibraryService.js'
import { HarnessManifestService } from './harnessManifestService.js'
import type { AppContext } from '$lib/model/appContext.js'
import { VisibilityService } from '$lib/services/visibilityService.svelte.js'
import { DummyRemoteApiService } from './dummyRemoteApiService.js'
import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import type { GameState, HydratedGameState } from '@tabletop/common'

const authorizationService = new HarnessAuthorizationService()
const notificationService = new DummyNotificationService()

const visibilityService = new VisibilityService() // No reason not to use the real one
const chatService = new HarnessChatService()
const api = new DummyRemoteApiService()

export type HarnessAppContext = AppContext & {
    chatService: HarnessChatService
    notificationService: DummyNotificationService
    api: DummyRemoteApiService
}

export function createHarnessAppContext(
    definition: GameUiDefinition<GameState, HydratedGameState>
): HarnessAppContext {
    const manifestService = new HarnessManifestService(definition)
    const libraryService = new HarnessLibraryService(definition)
    const gameService = new HarnessGameService(libraryService, authorizationService)
    return {
        manifestService,
        libraryService,
        authorizationService,
        notificationService,
        gameService,
        chatService,
        visibilityService,
        api
    }
}
