import { timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'
import * as Value from 'typebox/value'
import {
    canHoldAuthenticatedSession,
    NotificationCategory,
    SystemNotificationAction,
    type TopicRegistrationsChangedNotification
} from '@tabletop/common'

import type { UserService } from '../users/userService.js'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'
import {
    NotificationDistributionMethod,
    type NotificationService
} from '../notifications/notificationService.js'
import { telegramSubscriptionFor } from '../notifications/subscriptions/telegramSubscription.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import { userTopic } from '../notifications/topics.js'
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
        await this.announceRegistrationsChanged([userTopic(userId)])
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
        const [command, argument] = message.text.trim().split(/\s+/, 2)
        if (command === '/start') {
            await this.start(chatId, argument)
        } else if (command === '/stop') {
            await this.unregisterChat(chatId)
            await this.reply(chatId, this.stoppedMessage())
        } else {
            await this.reply(chatId, this.helpMessage())
        }
    }

    private async start(chatId: string, token: string | undefined) {
        const userId = token ? await this.redeem(token) : undefined
        const user = userId ? await this.dependencies.users.getUser(userId) : undefined
        if (!user || !canHoldAuthenticatedSession(user)) {
            await this.reply(chatId, this.notLinkedMessage())
            return
        }

        await this.unregisterChat(chatId)
        await this.dependencies.notifications.registerNotificationSubscription({
            subscription: telegramSubscriptionFor(chatId),
            topic: userTopic(user.id)
        })
        await this.announceRegistrationsChanged([userTopic(user.id)])
        await this.reply(chatId, this.connectedMessage(user.username))
    }

    private async unregisterChat(chatId: string) {
        const subscription = telegramSubscriptionFor(chatId)
        const topics = await this.dependencies.subscriptions.findSubscriptionTopics(subscription)
        if (topics.length === 0) return
        await this.dependencies.notifications.unregisterNotificationSubscription(subscription)
        await this.announceRegistrationsChanged(topics)
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

    // A failed push only leaves an open Notifications page stale until it reloads.
    private async announceRegistrationsChanged(topics: string[]) {
        const notification: TopicRegistrationsChangedNotification = {
            id: nanoid(),
            type: NotificationCategory.System,
            action: SystemNotificationAction.TopicRegistrationsChanged,
            data: {}
        }
        try {
            await this.dependencies.notifications.sendNotification({
                notification,
                topics,
                channels: [NotificationDistributionMethod.Topical]
            })
        } catch (error) {
            console.error('Could not announce a Telegram registration change', error)
        }
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

    private connectedMessage(username: string | undefined): string {
        const account = username ? ` as ${username}` : ''
        return `You're connected${account} on Board Together. I'll message you here when it's your turn or you're invited to a game. Send /stop to turn these messages off.`
    }

    private notLinkedMessage(): string {
        return `This chat isn't connected to a Board Together account. To connect it, press Connect on ${this.notificationsUrl()}. Each link works once, for an hour.`
    }

    private stoppedMessage(): string {
        return `Done. I won't message you here any more. To turn messages back on, press Connect on ${this.notificationsUrl()}.`
    }

    private helpMessage(): string {
        return `I only send Board Together notifications. Send /stop to turn them off, or manage them on ${this.notificationsUrl()}.`
    }
}
