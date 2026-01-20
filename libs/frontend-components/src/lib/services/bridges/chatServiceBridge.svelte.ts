import type { GameChat } from '@tabletop/common'
import type { ChatService } from '$lib/services/chatService.js'
import { RuneBackedStore } from '$lib/utils/runeBackedStore.svelte.js'

export class ChatServiceBridge {
    readonly currentGameChat: RuneBackedStore<GameChat | undefined>
    readonly hasUnreadMessages: RuneBackedStore<boolean>

    constructor(private chatService: ChatService) {
        this.currentGameChat = new RuneBackedStore(() => this.chatService.currentGameChat)
        this.hasUnreadMessages = new RuneBackedStore(() => this.chatService.hasUnreadMessages)
    }

    connect() {
        this.currentGameChat.connect()
        this.hasUnreadMessages.connect()
    }
}
