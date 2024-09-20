import { GameChat, GameChatMessage } from '@tabletop/common'
import { ChatStore } from '../persistence/stores/chatStore.js'

export class ChatService {
    constructor(private readonly chatStore: ChatStore) {}

    async getGameChat(gameId: string): Promise<GameChat | undefined> {
        return this.chatStore.findGameChat(gameId) ?? { gameId, messages: [] }
    }

    async addGameChatMessage(message: GameChatMessage, gameId: string): Promise<GameChat> {
        return this.chatStore.addGameChatMessage(message, gameId)
    }
}
