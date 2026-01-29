import type { ChatListener, ChatService } from '$lib/services/chatService.js'
import type { GameChat, GameChatMessage } from '@tabletop/common'

export class DummyChatService implements ChatService {
    currentGameChat: GameChat | undefined
    hasUnreadMessages: boolean = false
    setGameId(_gameId: string): void {}
    async sendGameChatMessage(
        _gameChatMessage: GameChatMessage,
        _gameId: string
    ): Promise<void> {}
    async setGameChatBookmark(_lastReadTimestamp: Date): Promise<void> {}
    async markLatestRead(): Promise<void> {}
    addListener(_listener: ChatListener): void {}
    removeListener(_listener: ChatListener): void {}
    clear(): void {}
}
