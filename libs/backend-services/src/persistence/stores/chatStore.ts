import { Bookmark, GameChat, GameChatMessage } from '@tabletop/common'

export type RedactedChatMessage = {
    chat: GameChat
    message: GameChatMessage
    // The text as it was, for the moderation record; never stored after redaction.
    originalText: string
    alreadyRedacted: boolean
}

export interface ChatStore {
    findGameChat(gameId: string): Promise<GameChat | undefined>
    addGameChatMessage(message: GameChatMessage, gameId: string): Promise<GameChat>
    redactGameChatMessage(gameId: string, messageId: string): Promise<RedactedChatMessage>
    getGameChatEtag(gameId: string): Promise<string | undefined>
    getGameChatBookmark(gameId: string, playerId: string): Promise<Bookmark>
    setGameChatBookmark(gameId: string, bookmark: Bookmark): Promise<void>
}
