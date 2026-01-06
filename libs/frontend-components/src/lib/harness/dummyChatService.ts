import type { ChatListener, ChatService } from '$lib/services/chatService.js'
import type { GameChat, GameChatMessage } from '@tabletop/common'

export class DummyChatService implements ChatService {
    currentGameChat: GameChat | undefined
    hasUnreadMessages: boolean = false
    setGameId(gameId: string): void {}
    async sendGameChatMessage(gameChatMessage: GameChatMessage, gameId: string): Promise<void> {}
    async setGameChatBookmark(lastReadTimestamp: Date): Promise<void> {}
    async markLatestRead(): Promise<void> {}
    addListener(listener: ChatListener): void {}
    removeListener(listener: ChatListener): void {}
    clear(): void {}
}
