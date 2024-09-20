import {
    GameChat,
    GameChatMessage,
    GameNotificationAction,
    GameNotificationChatData,
    Role,
    User
} from '@tabletop/common'
import { ChatStore } from '../persistence/stores/chatStore.js'
import { GameService } from '../games/gameService.js'

export class ChatService {
    constructor(
        private readonly gameService: GameService,
        private readonly chatStore: ChatStore
    ) {}

    async getGameChat(gameId: string): Promise<GameChat> {
        const chat = await this.chatStore.findGameChat(gameId)
        return chat ?? <GameChat>{ id: gameId, gameId, messages: [], checksum: 0 }
    }

    async addGameChatMessage(
        user: User,
        message: GameChatMessage,
        gameId: string
    ): Promise<GameChat> {
        const game = await this.gameService.getGame({ gameId })
        if (!game) {
            throw new Error('Game not found')
        }
        if (!user.roles.includes(Role.Admin)) {
            const player = this.gameService.findValidPlayerForUser({ user, game })
            if (player.id !== message.playerId) {
                throw new Error('Invalid player for game')
            }
        }

        const chat = await this.chatStore.addGameChatMessage(message, gameId)
        const updatedMessage = chat.messages.find((m) => m.id === message.id)
        if (!updatedMessage) {
            throw new Error('Failed to add message')
        }
        const notificationData: GameNotificationChatData = {
            game,
            message: updatedMessage,
            checksum: chat.checksum
        }

        this.gameService
            .notifyGameInstance(GameNotificationAction.Chat, notificationData)
            .catch((error) => {
                console.error('Failed to send chat notification', error)
            })

        return chat
    }
}
