import type { AuthorizationService } from '$lib/services/authorizationService.js'
import type { NotificationService } from '$lib/services/notificationService.js'
import type { GameService } from '$lib/services/gameService.js'
import type { LibraryService } from '$lib/services/libraryService.js'
import type { VisibilityService } from '$lib/services/visibilityService.svelte'
import type { ChatService } from '$lib/services/chatService.js'
import type { RemoteApiService } from '$lib/services/remoteApiService.js'
import { createContext } from 'svelte'
import type { ManifestService } from '$lib/services/manifestService.js'

export type AppContext = {
    manifestService: ManifestService
    libraryService: LibraryService
    authorizationService: AuthorizationService
    notificationService: NotificationService
    gameService: GameService
    visibilityService: VisibilityService
    chatService: ChatService
    api: RemoteApiService
}

const [getAppContextContext, setAppContextContext] = createContext<AppContext>()

export const setAppContext = setAppContextContext
export const getAppContext = getAppContextContext
