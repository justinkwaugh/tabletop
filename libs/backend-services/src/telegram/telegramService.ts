import { timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'
import * as Value from 'typebox/value'
import {
    canHoldAuthenticatedSession,
    NotificationCategory,
    type NotificationChannelsChangedNotification,
    SystemNotificationAction
} from '@tabletop/common'

import type { RedisCacheService } from '../cache/cacheService.js'
import type { UserService } from '../users/userService.js'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'
import {
    NotificationDistributionMethod,
    type NotificationService
} from '../notifications/notificationService.js'
import { telegramSubscriptionFor } from '../notifications/subscriptions/telegramSubscription.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import { userTopic } from '../notifications/topics.js'
import type { TelegramBotApi } from './telegramBotApi.js'
import { TelegramUpdate } from './telegramUpdate.js'

const NOTIFICATIONS_PATH = '/notifications'

/** How long a Connect Telegram link works; the Notifications page fetches one when it opens. */
export const TELEGRAM_LINK_SECONDS = 60 * 60

export type TelegramBot = {
    api: TelegramBotApi
    /** Telegram echoes this in X-Telegram-Bot-Api-Secret-Token on every webhook call. */
    webhookSecret: string
}

type TelegramServiceDependencies = {
    notifications: Pick<
        NotificationService,
        | 'registerNotificationSubscription'
        | 'unregisterNotificationSubscription'
        | 'sendNotification'
    >
    subscriptions: Pick<NotificationStore, 'findNotificationSubscriptions'>
    users: Pick<UserService, 'getUser'>
    cache: Pick<RedisCacheService, 'get' | 'set' | 'delete'>
}

/**
 * Links private Telegram chats with the site's bot to user accounts. A user opens a one-time
 * t.me deep link from the Notifications page and presses Start; the bot's webhook receives
 * `/start <token>` with the chat id and subscribes that chat to the user's topic.
 */
export class TelegramService {
    constructor(
        private readonly dependencies: TelegramServiceDependencies,
        private readonly bot: TelegramBot | undefined
    ) {}

    get isAvailable(): boolean {
        return this.bot !== undefined
    }

    isWebhookSecret(header: string | undefined): boolean {
        if (!this.bot || !header) return false
        const expected = Buffer.from(this.bot.webhookSecret)
        const received = Buffer.from(header)
        return expected.length === received.length && timingSafeEqual(expected, received)
    }

    async connectLink(userId: string): Promise<string> {
        const bot = this.requireBot()
        const token = nanoid(32)
        await this.dependencies.cache.set(linkKey(token), userId, TELEGRAM_LINK_SECONDS)
        const username = await bot.api.botUsername()
        return `https://t.me/${username}?start=${token}`
    }

    async isConnected(userId: string): Promise<boolean> {
        return (await this.chatIdsFor(userId)).length > 0
    }

    async disconnect(userId: string): Promise<void> {
        for (const chatId of await this.chatIdsFor(userId)) {
            await this.dependencies.notifications.unregisterNotificationSubscription(
                telegramSubscriptionFor(chatId)
            )
        }
        await this.announceChannelsChanged(userId)
    }

    async handleUpdate(update: unknown): Promise<void> {
        if (!Value.Check(TelegramUpdate, update)) {
            return
        }

        const blocked = update.my_chat_member
        if (blocked && blocked.chat.type === 'private') {
            if (blocked.new_chat_member.status === 'kicked') {
                await this.dependencies.notifications.unregisterNotificationSubscription(
                    telegramSubscriptionFor(String(blocked.chat.id))
                )
            }
            return
        }

        const message = update.message
        if (!message || message.chat.type !== 'private' || message.text === undefined) {
            return
        }

        const chatId = String(message.chat.id)
        const [command, argument] = message.text.trim().split(/\s+/, 2)
        if (command === '/start') {
            await this.start(chatId, argument)
        } else if (command === '/stop') {
            await this.stop(chatId)
        } else {
            await this.reply(chatId, helpMessage())
        }
    }

    private async start(chatId: string, token: string | undefined) {
        const userId = token ? await this.redeem(token) : undefined
        const user = userId ? await this.dependencies.users.getUser(userId) : undefined
        if (!user || !canHoldAuthenticatedSession(user)) {
            await this.reply(chatId, notLinkedMessage())
            return
        }

        // One chat follows one account: linking again moves it.
        const subscription = telegramSubscriptionFor(chatId)
        await this.dependencies.notifications.unregisterNotificationSubscription(subscription)
        await this.dependencies.notifications.registerNotificationSubscription({
            subscription,
            topic: userTopic(user.id)
        })
        await this.announceChannelsChanged(user.id)
        await this.reply(chatId, connectedMessage(user.username))
    }

    private async stop(chatId: string) {
        await this.dependencies.notifications.unregisterNotificationSubscription(
            telegramSubscriptionFor(chatId)
        )
        await this.reply(chatId, stoppedMessage())
    }

    private async redeem(token: string): Promise<string | undefined> {
        const key = linkKey(token)
        const { value } = await this.dependencies.cache.get<string>(key)
        if (typeof value !== 'string') return undefined
        await this.dependencies.cache.delete(key)
        return value
    }

    private async chatIdsFor(userId: string): Promise<string[]> {
        const subscriptions = await this.dependencies.subscriptions.findNotificationSubscriptions(
            userTopic(userId)
        )
        return subscriptions.flatMap((subscription) =>
            subscription.transport === TransportType.Telegram ? [subscription.chatId] : []
        )
    }

    // A failed push only leaves an open Notifications page stale until it reloads.
    private async announceChannelsChanged(userId: string) {
        const notification: NotificationChannelsChangedNotification = {
            id: nanoid(),
            type: NotificationCategory.System,
            action: SystemNotificationAction.NotificationChannelsChanged,
            data: {}
        }
        try {
            await this.dependencies.notifications.sendNotification({
                notification,
                topics: [userTopic(userId)],
                channels: [NotificationDistributionMethod.Topical]
            })
        } catch (error) {
            console.error('Could not announce a Telegram connection change', error)
        }
    }

    // A failed reply never fails the webhook; Telegram would retry the whole update.
    private async reply(chatId: string, text: string) {
        try {
            const result = await this.requireBot().api.sendMessage({
                chat_id: chatId,
                text,
                link_preview_options: { is_disabled: true }
            })
            if (!result.ok) {
                console.error('Could not reply in Telegram', chatId, result)
            }
        } catch (error) {
            console.error('Could not reply in Telegram', chatId, error)
        }
    }

    private requireBot(): TelegramBot {
        if (!this.bot) {
            throw new Error('Telegram notifications are not configured')
        }
        return this.bot
    }
}

function linkKey(token: string): string {
    return `telegram-link-${token}`
}

function notificationsUrl(): string {
    const frontendHost = process.env.FRONTEND_HOST
    return frontendHost ? new URL(NOTIFICATIONS_PATH, frontendHost).href : NOTIFICATIONS_PATH
}

function connectedMessage(username: string | undefined): string {
    const account = username ? ` as ${username}` : ''
    return `You're connected${account} on Board Together. I'll message you here when it's your turn or you're invited to a game. Send /stop to turn these messages off.`
}

function notLinkedMessage(): string {
    return `This chat isn't connected to a Board Together account. To connect it, press Connect Telegram on ${notificationsUrl()}. Each link works once, for an hour.`
}

function stoppedMessage(): string {
    return `Done. I won't message you here any more. To turn messages back on, press Connect Telegram on ${notificationsUrl()}.`
}

function helpMessage(): string {
    return `I only send Board Together notifications. Send /stop to turn them off, or manage them on ${notificationsUrl()}.`
}
