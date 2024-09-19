import { Chat, ChatMessage } from '@tabletop/common'
import { ChatStore } from '../persistence/stores/chatStore.js'

export class ChatService {
    constructor(private readonly chatStore: ChatStore) {}

    async getGameChat(gameId: string): Promise<Chat | undefined> {
        return this.chatStore.findGameChat(gameId) ?? { gameId, messages: [] }
    }

    async addMessage(message: ChatMessage, chat: Chat): Promise<Chat> {
        return this.chatStore.addMessage(message, chat)
    }
}
