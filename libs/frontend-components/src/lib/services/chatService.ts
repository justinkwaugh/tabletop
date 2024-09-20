import type { GameChat, GameChatMessage } from '@tabletop/common'

export type ChatService = {
    currentGameChat: GameChat | undefined
    setGameId(gameId: string): void
    sendGameChatMessage(gameChatMessage: GameChatMessage, gameId: string): Promise<void>
}
