import {
    Bookmark,
    GameChat,
    GameChatMessage,
    GameNotificationAction,
    GameNotificationChatData,
    Role,
    User
} from '@tabletop/common'
import { ChatStore } from '../persistence/stores/chatStore.js'
import { GameService } from '../games/gameService.js'
import { AddMessageError, InvalidChatMemberError } from './errors.js'
import { GameNotFoundError, UserIsNotAllowedPlayerError } from '../games/errors.js'

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
            throw new GameNotFoundError({ id: gameId })
        }
        if (!user.roles.includes(Role.Admin)) {
            const player = this.gameService.findValidPlayerForUser({ user, game })
            if (player.id !== message.playerId) {
                throw new InvalidChatMemberError({ playerId: player.id, gameId })
            }
        }

        const chat = await this.chatStore.addGameChatMessage(message, gameId)
        const updatedMessage = chat.messages.find((m) => m.id === message.id)
        if (!updatedMessage) {
            throw new AddMessageError({ gameId })
        }

        if (message.playerId) {
            await this.chatStore.setGameChatBookmark(gameId, {
                id: message.playerId,
                lastReadTimestamp: message.timestamp
            })
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

    async getGameChatEtag(gameId: string): Promise<string | undefined> {
        return await this.chatStore.getGameChatEtag(gameId)
    }

    async getGameChatBookmark(user: User, gameId: string): Promise<Bookmark> {
        const game = await this.gameService.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        try {
            const player = this.gameService.findValidPlayerForUser({ user, game })
            return await this.chatStore.getGameChatBookmark(gameId, player.id)
        } catch (error) {
            if (error instanceof UserIsNotAllowedPlayerError) {
                return { id: '', lastReadTimestamp: new Date(0) }
            }
            throw error
        }
    }

    async setGameChatBookmark(user: User, gameId: string, timestamp: Date): Promise<void> {
        const game = await this.gameService.getGame({ gameId })
        if (!game) {
            throw new GameNotFoundError({ id: gameId })
        }
        try {
            const player = this.gameService.findValidPlayerForUser({ user, game })
            const bookmark: Bookmark = { id: player.id, lastReadTimestamp: timestamp }

            const existingBookmark = await this.chatStore.getGameChatBookmark(gameId, player.id)
            if (
                existingBookmark &&
                existingBookmark.lastReadTimestamp.getTime() >= timestamp.getTime()
            ) {
                return
            }

            await this.chatStore.setGameChatBookmark(gameId, bookmark)
        } catch (error) {
            if (error instanceof UserIsNotAllowedPlayerError) {
                return
            }
            throw error
        }
    }
}
