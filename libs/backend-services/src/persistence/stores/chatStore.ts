import { GameChat, GameChatMessage } from '@tabletop/common'

export interface ChatStore {
    findGameChat(gameId: string): Promise<GameChat | undefined>
    addGameChatMessage(message: GameChatMessage, gameId: string): Promise<GameChat>
    getGameChatEtag(gameId: string): Promise<string | undefined>
}
