import type { AuthorizationService } from '$lib/services/authorizationService.js'
import { AuthorizationBridge } from './authorizationBridge.svelte.js'
import type { GameService } from '$lib/services/gameService.js'
import { GameServiceBridge } from './gameServiceBridge.svelte.js'
import type { ChatService } from '$lib/services/chatService.js'
import { ChatServiceBridge } from './chatServiceBridge.svelte.js'

export type BridgedContextOptions = {
    authorizationService: AuthorizationService
    gameService: GameService
    chatService: ChatService
    gameId: string
}

export class BridgedContext {
    readonly authorization: AuthorizationBridge
    readonly gameService: GameServiceBridge
    readonly chatService: ChatServiceBridge
    private stopEffects?: () => void

    constructor({ authorizationService, gameService, chatService, gameId }: BridgedContextOptions) {
        this.authorization = new AuthorizationBridge(authorizationService)
        this.gameService = new GameServiceBridge(gameService, gameId)
        this.chatService = new ChatServiceBridge(chatService)
        this.stopEffects = $effect.root(() => {
            this.authorization.connect()
            this.gameService.connect()
            this.chatService.connect()
        })
    }

    dispose() {
        this.stopEffects?.()
        this.stopEffects = undefined
    }
}
