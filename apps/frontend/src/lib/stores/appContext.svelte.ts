import { TabletopApi } from '@tabletop/frontend-components'
import { PUBLIC_API_HOST, PUBLIC_SSE_HOST } from '$env/static/public'
import { AuthorizationService } from '$lib/services/authorizationService.svelte'
import { NotificationService } from '$lib/services/notificationService.svelte'
import { GameService } from '$lib/services/gameService.svelte'
import { LibraryService } from '$lib/services/libraryService'

export type AppContext = {
    libraryService: LibraryService
    authorizationService: AuthorizationService
    notificationService: NotificationService
    gameService: GameService
    api: TabletopApi
}

const api = new TabletopApi(PUBLIC_API_HOST, PUBLIC_SSE_HOST)
const libraryService = new LibraryService()
const authorizationService = new AuthorizationService(api)
const notificationService = new NotificationService(authorizationService, api)

const appContext: AppContext = {
    libraryService,
    authorizationService,
    notificationService,
    gameService: new GameService(authorizationService, notificationService, api),
    api
}

export function getAppContext(): AppContext {
    return appContext
}
