import { timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'
import * as Value from 'typebox/value'
import { canHoldAuthenticatedSession, type User } from '@tabletop/common'
import { m, replyLocale, type Locale } from '@tabletop/email/i18n'

import type { UserService } from '../users/userService.js'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'
import type { NotificationService } from '../notifications/notificationService.js'
import { announceTopicRegistrationsChanged } from '../notifications/topicRegistrationsChanged.js'
import { telegramSubscriptionFor } from '../notifications/subscriptions/telegramSubscription.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import { topicUserId, userTopic } from '../notifications/topics.js'
import { siteUrl } from '../site/siteUrl.js'
import type { TelegramBotApi } from './telegramBotApi.js'
import { TelegramUpdate } from './telegramUpdate.js'

const NOTIFICATIONS_PATH = '/notifications'

export const TELEGRAM_LINK_SECONDS = 60 * 60

export type TelegramBot = {
    api: Pick<TelegramBotApi, 'sendMessage' | 'botUsername'>
    // Telegram echoes this in X-Telegram-Bot-Api-Secret-Token on every webhook call.
    webhookSecret: string
}

export type TelegramLinkTokens = {
    get(key: string): Promise<{ value: unknown }>
    set(key: string, value: string, forSeconds: number): Promise<void>
    delete(key: string): Promise<void>
}

type TelegramServiceDependencies = {
    notifications: Pick<
        NotificationService,
        | 'registerNotificationSubscription'
        | 'unregisterNotificationSubscription'
        | 'sendNotification'
    >
    subscriptions: Pick<
        NotificationStore,
        'findNotificationSubscriptions' | 'findSubscriptionTopics'
    >
    users: Pick<UserService, 'getUser'>
    linkTokens: TelegramLinkTokens
}

export class TelegramService {
    constructor(
        private readonly dependencies: TelegramServiceDependencies,
        private readonly bot: TelegramBot | undefined,
        private readonly frontendHost: string
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
        await this.dependencies.linkTokens.set(this.linkKey(token), userId, TELEGRAM_LINK_SECONDS)
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
        await announceTopicRegistrationsChanged(this.dependencies.notifications, [
            userTopic(userId)
        ])
    }

    async handleUpdate(update: unknown): Promise<void> {
        if (!Value.Check(TelegramUpdate, update)) {
            return
        }

        const membership = update.my_chat_member
        if (membership && membership.chat.type === 'private') {
            if (membership.new_chat_member.status === 'kicked') {
                await this.unregisterChat(String(membership.chat.id))
            }
            return
        }

        const message = update.message
        if (!message || message.chat.type !== 'private' || message.text === undefined) {
            return
        }

        const chatId = String(message.chat.id)
        const languageCode = message.from?.language_code
        const [command, argument] = message.text.trim().split(/\s+/, 2)
        if (command === '/start') {
            await this.start(chatId, argument, languageCode)
            return
        }
        const locale = replyLocale(await this.chatAccount(chatId), languageCode)
        if (command === '/stop') {
            await this.unregisterChat(chatId)
            await this.reply(chatId, this.stoppedMessage(locale))
        } else {
            await this.reply(chatId, this.helpMessage(locale))
        }
    }

    private async start(chatId: string, token: string | undefined, languageCode?: string) {
        const userId = token ? await this.redeem(token) : undefined
        const user = userId ? await this.dependencies.users.getUser(userId) : undefined
        if (!user || !canHoldAuthenticatedSession(user)) {
            const locale = replyLocale(await this.chatAccount(chatId), languageCode)
            await this.reply(chatId, this.notLinkedMessage(locale))
            return
        }

        await this.unregisterChat(chatId)
        await this.dependencies.notifications.registerNotificationSubscription({
            subscription: telegramSubscriptionFor(chatId),
            topic: userTopic(user.id)
        })
        await announceTopicRegistrationsChanged(this.dependencies.notifications, [
            userTopic(user.id)
        ])
        await this.reply(
            chatId,
            this.connectedMessage(user.username, replyLocale(user, languageCode))
        )
    }

    private async chatAccount(chatId: string): Promise<User | undefined> {
        const topics = await this.dependencies.subscriptions.findSubscriptionTopics(
            telegramSubscriptionFor(chatId)
        )
        const userId = topics.map(topicUserId).find((id) => id !== undefined)
        return userId ? await this.dependencies.users.getUser(userId) : undefined
    }

    private async unregisterChat(chatId: string) {
        const subscription = telegramSubscriptionFor(chatId)
        const topics = await this.dependencies.subscriptions.findSubscriptionTopics(subscription)
        if (topics.length === 0) return
        await this.dependencies.notifications.unregisterNotificationSubscription(subscription)
        await announceTopicRegistrationsChanged(this.dependencies.notifications, topics)
    }

    private async redeem(token: string): Promise<string | undefined> {
        const key = this.linkKey(token)
        const { value } = await this.dependencies.linkTokens.get(key)
        if (typeof value !== 'string') return undefined
        await this.dependencies.linkTokens.delete(key)
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

    // A failed reply never fails the webhook; Telegram would redeliver the whole update.
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

    private linkKey(token: string): string {
        return `telegram-link-${token}`
    }

    private notificationsUrl(): string {
        return siteUrl(NOTIFICATIONS_PATH, this.frontendHost)
    }

    private connectedMessage(username: string | undefined, locale: Locale): string {
        return username
            ? m.telegram_connected_as({ username }, { locale })
            : m.telegram_connected({}, { locale })
    }

    private notLinkedMessage(locale: Locale): string {
        return m.telegram_not_linked({ url: this.notificationsUrl() }, { locale })
    }

    private stoppedMessage(locale: Locale): string {
        return m.telegram_stopped({ url: this.notificationsUrl() }, { locale })
    }

    private helpMessage(locale: Locale): string {
        return m.telegram_help({ url: this.notificationsUrl() }, { locale })
    }
}
