import { TabletopApi, type AppContext, VisibilityService } from '@tabletop/frontend-components'
import {
    PUBLIC_API_HOST,
    PUBLIC_SSE_HOST,
    PUBLIC_VERSION,
    PUBLIC_ENABLE_ABLY_REALTIME
} from '$env/static/public'
import { AuthorizationService } from '$lib/services/authorizationService.svelte'
import { NotificationService } from '$lib/services/notificationService.svelte'
import { GameService } from '$lib/services/gameService.svelte'
import { LibraryService } from '$lib/services/libraryService'
import { AblyConnection } from '$lib/network/ablyConnection.svelte'
import { ChatService } from '$lib/services/chatService.svelte'
import { SseConnection } from '$lib/network/sseConnection.svelte.js'

const api = new TabletopApi(PUBLIC_API_HOST, PUBLIC_SSE_HOST, PUBLIC_VERSION)
const authorizationService = new AuthorizationService(api)
const libraryService = new LibraryService(authorizationService)

const visibilityService = new VisibilityService()
let realtimeConnection

if (PUBLIC_ENABLE_ABLY_REALTIME) {
    realtimeConnection = new AblyConnection(api)
} else {
    realtimeConnection = new SseConnection({ api })
}
const notificationService = new NotificationService(
    realtimeConnection,
    visibilityService,
    authorizationService,
    api
)
const chatService = new ChatService(authorizationService, notificationService, api)

const appContext: AppContext = {
    libraryService,
    authorizationService,
    notificationService,
    gameService: new GameService(libraryService, authorizationService, notificationService, api),
    chatService: chatService,
    visibilityService,
    api
}

export function getAppContext(): AppContext {
    return appContext
}
