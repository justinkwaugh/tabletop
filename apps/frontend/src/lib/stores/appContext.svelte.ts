import { TabletopApi, type AppContext, VisibilityService } from '@tabletop/frontend-components'
import {
    PUBLIC_API_HOST,
    PUBLIC_SSE_HOST,
    PUBLIC_ENABLE_ABLY_REALTIME,
    PUBLIC_GAME_UI_BASE_URL,
    PUBLIC_REALTIME_RELAY_HOST
} from '$env/static/public'
import { AuthorizationService } from '$lib/services/authorizationService.svelte'
import { NotificationService } from '$lib/services/notificationService.svelte'
import { GameService } from '$lib/services/gameService.svelte'
import { LibraryService } from '$lib/services/libraryService.svelte'
import { ManifestService } from '$lib/services/manifestService'
import { CatalogService } from '$lib/services/catalogService.svelte'
import { FRONTEND_VERSION } from '$lib/version'
import { AblyConnection } from '$lib/network/ablyConnection.svelte'
import { ChatService } from '$lib/services/chatService.svelte'
import { SseConnection } from '$lib/network/sseConnection.svelte.js'
import { RelayConnection } from '$lib/network/relayConnection'
import { closedWhileHidden, type RealtimeConnection } from '$lib/network/realtimeConnection'
import { UserPreferencesEditor } from '$lib/services/userPreferencesEditor.svelte'
import { toast } from 'svelte-sonner'
const api = new TabletopApi(PUBLIC_API_HOST, PUBLIC_SSE_HOST, FRONTEND_VERSION, () =>
    authorizationService.clearSessionUser()
)
console.log('Initialized API with frontend version:', FRONTEND_VERSION)
const manifestService = new ManifestService(api)
api.setGameVersionProvider(manifestService)
const libraryService = new LibraryService(manifestService, PUBLIC_GAME_UI_BASE_URL)
const authorizationService = new AuthorizationService(
    api,
    () => {
        void libraryService.whenReady()
    },
    () => gameService.clear()
)

const visibilityService = new VisibilityService()
let realtimeConnection: RealtimeConnection

if (PUBLIC_REALTIME_RELAY_HOST) {
    realtimeConnection = new RelayConnection(api, PUBLIC_REALTIME_RELAY_HOST)
} else if (PUBLIC_ENABLE_ABLY_REALTIME) {
    realtimeConnection = closedWhileHidden(new AblyConnection(api))
} else {
    realtimeConnection = closedWhileHidden(new SseConnection({ api }))
}
const notificationService = new NotificationService(
    realtimeConnection,
    visibilityService,
    authorizationService,
    api
)
const chatService = new ChatService(authorizationService, notificationService, api)
const gameService = new GameService(libraryService, authorizationService, notificationService, api)
const userPreferencesEditor = new UserPreferencesEditor(
    () => authorizationService.getSessionUser(),
    api,
    (user) => authorizationService.setSessionUser(user),
    () => toast.error('Could not save your preferences. Please try again.')
)

const appContext: AppContext & {
    catalogService: CatalogService
    authorizationService: AuthorizationService
    gameService: GameService
    userPreferencesEditor: UserPreferencesEditor
} = {
    catalogService: new CatalogService(api),
    manifestService,
    libraryService,
    authorizationService,
    notificationService,
    gameService,
    chatService: chatService,
    visibilityService,
    userPreferencesEditor,
    api
}

export function getAppContext(): typeof appContext {
    return appContext
}
