import type { GameChat } from '@tabletop/common'
import type { ChatService } from '$lib/services/chatService.js'
import { writable, type Writable } from 'svelte/store'

export class ChatServiceBridge {
    readonly currentGameChat: Writable<GameChat | undefined>
    readonly hasUnreadMessages: Writable<boolean>

    constructor(private chatService: ChatService) {
        this.currentGameChat = writable(this.chatService.currentGameChat)
        this.hasUnreadMessages = writable(this.chatService.hasUnreadMessages)
    }

    connect() {
        $effect(() => {
            this.currentGameChat.set(this.chatService.currentGameChat)
            this.hasUnreadMessages.set(this.chatService.hasUnreadMessages)
        })
    }
}
