import type { ChatEvent, ChatListener, ChatService } from '$lib/services/chatService.js'
import { ChatEventType } from '$lib/services/chatService.js'
import {
    addToChecksum,
    assertExists,
    type Game,
    type GameChat,
    type GameChatMessage
} from '@tabletop/common'

export class HarnessChatService implements ChatService {
    private listeners = new Set<ChatListener>()
    private currentGameId: string | undefined = $state(undefined)
    private lastReadTimestamp: Date | undefined = $state(undefined)

    currentGameChat: GameChat | undefined = $state(undefined)
    get hasUnreadMessages(): boolean {
        const chat = this.currentGameChat
        if (!this.currentGameId || chat?.gameId !== this.currentGameId) {
            return false
        }

        const messages = chat.messages
        if (messages.length === 0) {
            return false
        }

        return messages.some(
            (message) =>
                this.lastReadTimestamp === undefined || message.timestamp > this.lastReadTimestamp
        )
    }

    constructor(private readonly now: () => Date = () => new Date()) {}

    isAvailable(_game: Pick<Game, 'hotseat'>): boolean {
        return true
    }

    setGame(game: Pick<Game, 'id' | 'players'>): void {
        const messages = this.createFixtureMessages(game)
        const messageIds = messages.map((message) => message.id)

        this.currentGameId = game.id
        this.lastReadTimestamp = messages.at(-2)?.timestamp
        this.currentGameChat = {
            id: `harness-chat-${game.id}`,
            gameId: game.id,
            checksum: addToChecksum(0, messageIds),
            messages
        }
    }

    setGameId(gameId: string): void {
        if (gameId === this.currentGameId) {
            return
        }

        this.currentGameId = gameId
        this.lastReadTimestamp = undefined
        this.currentGameChat = {
            id: `harness-chat-${gameId}`,
            gameId,
            checksum: 0,
            messages: []
        }
    }

    async sendGameChatMessage(message: GameChatMessage, gameId: string): Promise<void> {
        if (!this.currentGameChat || gameId !== this.currentGameId) {
            return
        }

        this.currentGameChat.messages.push(message)
        this.currentGameChat.checksum = addToChecksum(this.currentGameChat.checksum, [message.id])
        this.lastReadTimestamp = message.timestamp

        const event: ChatEvent = {
            eventType: ChatEventType.NewGameChatMessage,
            message
        }
        await Promise.all(
            [...this.listeners].map(async (listener) => {
                try {
                    await listener(event)
                } catch (error) {
                    console.error('Failed to notify harness chat listener', error)
                }
            })
        )
    }

    async setGameChatBookmark(lastReadTimestamp: Date): Promise<void> {
        if (
            this.lastReadTimestamp &&
            lastReadTimestamp.getTime() <= this.lastReadTimestamp.getTime()
        ) {
            return
        }

        this.lastReadTimestamp = lastReadTimestamp
    }

    async markLatestRead(): Promise<void> {
        const latestMessage = this.currentGameChat?.messages.at(-1)
        if (latestMessage) {
            await this.setGameChatBookmark(latestMessage.timestamp)
        }
    }

    addListener(listener: ChatListener): void {
        this.listeners.add(listener)
    }

    removeListener(listener: ChatListener): void {
        this.listeners.delete(listener)
    }

    clear(): void {
        this.currentGameId = undefined
        this.lastReadTimestamp = undefined
        this.currentGameChat = undefined
    }

    private createFixtureMessages(game: Pick<Game, 'id' | 'players'>): GameChatMessage[] {
        const firstPlayer = game.players.at(0)
        assertExists(firstPlayer, 'Harness chat requires at least one Player')

        const players = game.players
        const now = this.now().getTime()
        const fixtures = [
            {
                text: 'Ready when you are.',
                timestamp: new Date(now - 12 * 60 * 1000)
            },
            {
                text: 'This message has two lines.\nThe second line checks spacing.',
                timestamp: new Date(now - 7 * 60 * 1000)
            },
            {
                text: 'A longer message helps check wrapping in narrow layouts while emoji stay aligned with the surrounding text. 🎲 ✨',
                timestamp: new Date(now - 2 * 60 * 1000)
            }
        ]

        return fixtures.map((fixture, index) => ({
            id: `harness-message-${game.id}-${index + 1}`,
            playerId: players[index % players.length].id,
            timestamp: fixture.timestamp,
            text: fixture.text
        }))
    }
}
