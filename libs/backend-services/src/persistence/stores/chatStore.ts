import { Chat, ChatMessage } from '@tabletop/common'

export interface ChatStore {
    findGameChat(gameId: string): Promise<Chat | undefined>
    addMessage(message: ChatMessage, chat: Chat): Promise<Chat>
}
