import {
    TabletopApi,
    type AuthorizationService,
    type NotificationEvent,
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type ChatListener,
    type ChatGameOptions,
    type NewGameChatMessageEvent,
    ChatEventType
} from '@tabletop/frontend-components'
import {
    Notification,
    NotificationCategory,
    type Game,
    GameChat,
    GameChatMessage,
    addToChecksum,
    GameChatNotification,
    GameNotificationAction
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { NotificationService } from './notificationService.svelte'

export class ChatService {
    private loading = $state(false)
    private loaded = false
    private generation = 0
    private loadPromise: Promise<void> | undefined
    private reloadRequested = false
    private listeners: Set<ChatListener> = new Set()

    private currentGameId: string | undefined = $state(undefined)
    private trackReadPosition = $state(true)
    currentGameChat: GameChat | undefined = $state(undefined)
    lastReadTimestamp: Date | undefined = $state(undefined)

    sessionUserId: string | undefined = $derived.by(() => {
        return this.authorizationService.getSessionUser()?.id
    })

    hasUnreadMessages: boolean = $derived.by(() => {
        const messages = this.currentGameChat?.messages ?? []
        if (!this.trackReadPosition || messages.length === 0) {
            return false
        }
        return (
            this.lastReadTimestamp === undefined ||
            messages.some((message) => message.timestamp > (this.lastReadTimestamp ?? new Date(0)))
        )
    })

    constructor(
        private readonly authorizationService: Pick<AuthorizationService, 'getSessionUser'>,
        private readonly notificationService: Pick<NotificationService, 'addListener' | 'isUserChannelReady'>,
        private readonly api: TabletopApi
    ) {
        notificationService.addListener(this.NotificationListener)
    }

    isAvailable(game: Pick<Game, 'hotseat'>): boolean {
        return !game.hotseat
    }

    isLoading(): boolean {
        return this.loading
    }

    setGameId(gameId: string, options: ChatGameOptions = {}) {
        if (gameId === this.currentGameId) {
            return
        }

        this.clear()
        this.currentGameId = gameId
        this.trackReadPosition = options.trackReadPosition ?? true
        this.loading = true
        if (!this.notificationService.isUserChannelReady()) return
        this.loadGameChat().catch((error) => {
            console.error('Failed to load game chat', error)
        })
    }

    clear() {
        this.generation++
        this.loadPromise = undefined
        this.reloadRequested = false
        this.currentGameId = undefined
        this.trackReadPosition = true
        this.currentGameChat = undefined
        this.lastReadTimestamp = undefined
        this.loaded = false
        this.loading = false
    }

    addListener(listener: ChatListener) {
        if (this.listeners.has(listener)) {
            return
        }
        this.listeners.add(listener)
    }

    removeListener(listener: ChatListener) {
        this.listeners.delete(listener)
    }

    private loadGameChat(): Promise<void> {
        if (this.loadPromise) return this.loadPromise
        if (!this.currentGameId || this.loaded) {
            return Promise.resolve()
        }
        this.loading = true
        const generation = this.generation
        this.loadPromise = this.readGameChat(this.currentGameId, generation).finally(() => {
            if (generation !== this.generation) return
            this.loading = false
            this.loadPromise = undefined
        })
        return this.loadPromise
    }

    private async readGameChat(gameId: string, generation: number) {
        do {
            this.reloadRequested = false
            const [gameChat, bookmark] = await Promise.all([
                this.api.getGameChat(gameId),
                this.trackReadPosition ? this.api.getGameChatBookmark(gameId) : undefined
            ])
            if (generation !== this.generation) return
            if (this.reloadRequested) continue
            this.lastReadTimestamp = bookmark?.lastReadTimestamp
            this.currentGameChat = gameChat
            this.loaded = true
        } while (this.reloadRequested)
    }

    private async reloadGameChat() {
        this.loaded = false
        if (this.loadPromise) this.reloadRequested = true
        await this.loadGameChat()
    }

    async sendGameChatMessage(gameChatMessage: GameChatMessage, gameId: string): Promise<void> {
        if (!this.currentGameChat) {
            return
        }

        this.currentGameChat.messages.push(gameChatMessage)
        const originalChecksum = this.currentGameChat.checksum
        const originalBookmark = this.lastReadTimestamp
        try {
            this.lastReadTimestamp = gameChatMessage.timestamp
            const { message, checksum, missedMessages } = await this.api.sendGameChatMessage(
                gameChatMessage,
                gameId,
                originalChecksum
            )
            const messageIndex = this.currentGameChat.messages.findIndex(
                (message) => message.id === gameChatMessage.id
            )

            this.currentGameChat.messages.push(...missedMessages)
            this.currentGameChat.messages[messageIndex] = message
            this.currentGameChat.messages.sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            )

            const expectedChecksum = addToChecksum(
                originalChecksum,
                [...missedMessages, message].map((m) => m.id)
            )
            if (checksum !== expectedChecksum) {
                console.error('Chat checksum mismatch... fetching full chat', {
                    checksum,
                    expectedChecksum
                })
                this.reloadGameChat().catch((error) => {
                    console.error('Failed to reload game chat', error)
                })
            } else {
                this.currentGameChat.checksum = checksum
            }
        } catch (error) {
            console.error('Failed to send game chat message', error)
            const messageIndex = this.currentGameChat.messages.findIndex(
                (message) => message.id === gameChatMessage.id
            )
            this.currentGameChat.messages.splice(messageIndex, 1)
            this.lastReadTimestamp = originalBookmark
        }
    }

    async setGameChatBookmark(lastReadTimestamp: Date): Promise<void> {
        if (!this.currentGameChat || !this.trackReadPosition) {
            return
        }

        if (
            this.lastReadTimestamp &&
            lastReadTimestamp.getTime() <= this.lastReadTimestamp.getTime()
        ) {
            return
        }

        try {
            await this.api.setGameChatBookmark(lastReadTimestamp, this.currentGameChat.gameId)
            this.lastReadTimestamp = lastReadTimestamp
        } catch (error) {
            console.error('Failed to set game chat bookmark', error)
        }
    }

    async markLatestRead(): Promise<void> {
        if (!this.currentGameChat || this.currentGameChat.messages.length === 0) {
            return
        }

        await this.setGameChatBookmark(
            this.currentGameChat.messages[this.currentGameChat.messages.length - 1].timestamp
        )
    }

    private NotificationListener = async (event: NotificationEvent) => {
        if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
            await this.reloadGameChat()
            return
        }

        if (isDataEvent(event)) {
            const notification = event.notification
            if (!this.isGameChatNotification(notification) || notification.data.game.id !== this.currentGameId) {
                return
            }

            if (this.loadPromise) {
                await this.reloadGameChat()
                return
            }
            if (!this.currentGameChat) return

            const newMessage = Value.Convert(
                GameChatMessage,
                notification.data.message
            ) as GameChatMessage

            if (!Value.Check(GameChatMessage, newMessage)) {
                console.error('Invalid GameChatMessage format in notification')
                return
            }

            if (this.currentGameChat.messages.find((m) => m.id === newMessage.id)) {
                return
            }

            const chatEvent: NewGameChatMessageEvent = {
                eventType: ChatEventType.NewGameChatMessage,
                message: newMessage
            }
            for (const listener of this.listeners) {
                listener(chatEvent).catch(() => {
                    console.error('Failed to notify chat listener')
                })
            }

            this.currentGameChat?.messages.push(newMessage)
            const expectedChecksum = addToChecksum(this.currentGameChat?.checksum, [newMessage.id])
            if (expectedChecksum !== notification.data.checksum) {
                console.error('Chat checksum mismatch... fetching full chat', {
                    expectedChecksum,
                    checksum: notification.data.checksum
                })
                await this.reloadGameChat()
            } else {
                this.currentGameChat.checksum = notification.data.checksum
            }
        }
    }

    private isGameChatNotification(
        notification: Notification
    ): notification is GameChatNotification {
        return (
            notification.type === NotificationCategory.Game &&
            notification.action === GameNotificationAction.Chat
        )
    }
}
