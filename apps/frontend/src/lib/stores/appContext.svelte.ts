import { TabletopApi } from '@tabletop/frontend-components'
import { PUBLIC_API_HOST, PUBLIC_SSE_HOST, PUBLIC_VERSION } from '$env/static/public'
import { AuthorizationService } from '$lib/services/authorizationService.svelte'
import { NotificationService } from '$lib/services/notificationService.svelte'
import { GameService } from '$lib/services/gameService.svelte'
import { LibraryService } from '$lib/services/libraryService'
import { VisibilityService } from '$lib/services/visibilityService.svelte'
import { AblyConnection } from '$lib/network/ablyConnection.svelte'
import { ChatService } from '$lib/services/chatService.svelte'

export type AppContext = {
    libraryService: LibraryService
    authorizationService: AuthorizationService
    notificationService: NotificationService
    gameService: GameService
    visibilityService: VisibilityService
    chatService: ChatService
    api: TabletopApi
}

const api = new TabletopApi(PUBLIC_API_HOST, PUBLIC_SSE_HOST, PUBLIC_VERSION)
const authorizationService = new AuthorizationService(api)
const libraryService = new LibraryService(authorizationService)

const visibilityService = new VisibilityService()
const realtimeConnection = new AblyConnection(api)
// this.realtimeConnection = new SseConnection({ api })
const notificationService = new NotificationService(
    realtimeConnection,
    visibilityService,
    authorizationService,
    api
)

const appContext: AppContext = {
    libraryService,
    authorizationService,
    notificationService,
    gameService: new GameService(authorizationService, notificationService, api),
    chatService: new ChatService(authorizationService, notificationService, api),
    visibilityService,
    api
}

export function getAppContext(): AppContext {
    return appContext
}
