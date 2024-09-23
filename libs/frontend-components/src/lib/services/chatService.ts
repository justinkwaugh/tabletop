import type { GameChat, GameChatMessage } from '@tabletop/common'

export enum ChatEventType {
    NewGameChatMessage = 'newGameChatMessage'
}

export type NewGameChatMessageEvent = {
    eventType: ChatEventType.NewGameChatMessage
    message: GameChatMessage
}

export type ChatEvent = NewGameChatMessageEvent

export function isNewGameChatMessageEvent(event: ChatEvent): event is NewGameChatMessageEvent {
    return event.eventType === ChatEventType.NewGameChatMessage
}

export type ChatListener = (event: ChatEvent) => Promise<void>

export type ChatService = {
    currentGameChat: GameChat | undefined
    hasUnreadMessages: boolean
    setGameId(gameId: string): void
    sendGameChatMessage(gameChatMessage: GameChatMessage, gameId: string): Promise<void>
    setGameChatBookmark(lastReadTimestamp: Date): Promise<void>
    markLatestRead(): Promise<void>
    addListener(listener: ChatListener): void
    removeListener(listener: ChatListener): void
}
