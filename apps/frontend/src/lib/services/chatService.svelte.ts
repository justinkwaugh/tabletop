/* eslint-disable svelte/prefer-svelte-reactivity */
import {
    TabletopApi,
    type AuthorizationService,
    type NotificationEvent,
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type ChatListener,
    type NewGameChatMessageEvent,
    ChatEventType
} from '@tabletop/frontend-components'
import {
    Notification,
    NotificationCategory,
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
    private listeners: Set<ChatListener> = new Set()

    private currentGameId: string | undefined = $state(undefined)
    currentGameChat: GameChat | undefined = $state(undefined)
    lastReadTimestamp: Date | undefined = $state(undefined)

    sessionUserId: string | undefined = $derived.by(() => {
        return this.authorizationService.getSessionUser()?.id
    })

    hasUnreadMessages: boolean = $derived.by(() => {
        const messages = this.currentGameChat?.messages ?? []
        if (messages.length === 0) {
            return false
        }
        return (
            this.lastReadTimestamp === undefined ||
            messages.some((message) => message.timestamp > (this.lastReadTimestamp ?? new Date(0)))
        )
    })

    constructor(
        private readonly authorizationService: AuthorizationService,
        private readonly notificationService: NotificationService,
        private readonly api: TabletopApi
    ) {
        notificationService.addListener(this.NotificationListener)
    }

    isLoading(): boolean {
        return this.loading
    }

    setGameId(gameId: string) {
        if (gameId === this.currentGameId) {
            return
        }

        this.clear()
        this.currentGameId = gameId
        this.loadGameChat().catch((error) => {
            console.error('Failed to load game chat', error)
        })
    }

    clear() {
        this.currentGameId = undefined
        this.currentGameChat = undefined
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

    private async loadGameChat() {
        if (!this.currentGameId || this.loaded) {
            return
        }
        this.loading = true
        const gameChat = await this.api.getGameChat(this.currentGameId)
        if (gameChat.gameId !== this.currentGameId) {
            return
        }
        const bookmark = await this.api.getGameChatBookmark(this.currentGameId)
        this.lastReadTimestamp = bookmark.lastReadTimestamp

        this.currentGameChat = gameChat
        this.loading = false
        this.loaded = true
    }

    private async reloadGameChat() {
        this.loaded = false
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
        if (!this.currentGameChat) {
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
        if (!this.currentGameChat) {
            return
        }

        if (isDataEvent(event)) {
            const notification = event.notification
            if (!this.isGameChatNotification(notification)) {
                return
            }

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
        } else if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
            await this.reloadGameChat()
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
