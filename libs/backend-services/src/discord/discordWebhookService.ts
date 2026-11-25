import {
    assert,
    isActiveNamedAccount,
    DiscordWebhookConnectResult,
    ExternalAuthService,
    type User
} from '@tabletop/common'

import type { NotificationService } from '../notifications/notificationService.js'
import {
    type DiscordWebhookSubscription,
    discordWebhookSubscriptionId
} from '../notifications/subscriptions/discordWebhookSubscription.js'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'
import { announceTopicRegistrationsChanged } from '../notifications/topicRegistrationsChanged.js'
import { userTopic } from '../notifications/topics.js'
import { discordWebhookConnectedMessage } from '../notifications/transports/discordWebhookNotificationMessage.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import type { UserService } from '../users/userService.js'
import { messageLocale } from '@tabletop/email/i18n'
import {
    type DiscordWebhookApi,
    type DiscordWebhookCredentials,
    type DiscordWebhookLookup,
    parseDiscordWebhookUrl
} from './discordWebhookApi.js'

type WebhookCheck =
    { kind: 'usable'; name: string } | { kind: 'rejected'; result: DiscordWebhookConnectResult }

const LOOKUP_REJECTIONS: Record<
    Exclude<DiscordWebhookLookup['kind'], 'found'>,
    DiscordWebhookConnectResult
> = {
    gone: DiscordWebhookConnectResult.NotFound,
    unsupported: DiscordWebhookConnectResult.Unsupported,
    failed: DiscordWebhookConnectResult.Failed
}

type DiscordWebhookServiceDependencies = {
    notifications: Pick<
        NotificationService,
        | 'registerNotificationSubscription'
        | 'unregisterNotificationSubscription'
        | 'sendNotification'
    >
    subscriptions: Pick<NotificationStore, 'findNotificationSubscriptions'>
    users: Pick<UserService, 'getUser' | 'extractExternalId'>
    webhooks: Pick<DiscordWebhookApi, 'lookup' | 'execute'>
}

export class DiscordWebhookService {
    constructor(
        private readonly dependencies: DiscordWebhookServiceDependencies,
        private readonly frontendHost: string
    ) {}

    async connect(userId: string, url: string): Promise<DiscordWebhookConnectResult> {
        const webhook = parseDiscordWebhookUrl(url)
        if (!webhook) {
            return DiscordWebhookConnectResult.InvalidUrl
        }

        const user = await this.dependencies.users.getUser(userId)
        assert(isActiveNamedAccount(user), `No active user ${userId} to connect a webhook for`)

        const webhookCheck = await this.checkWebhook(webhook, user)
        if (webhookCheck.kind === 'rejected') {
            return webhookCheck.result
        }

        // The store keeps an existing subscription's data, so the old webhook goes first.
        await this.unregisterWebhooks(userId)
        await this.dependencies.notifications.registerNotificationSubscription({
            subscription: {
                id: discordWebhookSubscriptionId(userId, webhook.id),
                transport: TransportType.DiscordWebhook,
                userId,
                webhookId: webhook.id,
                webhookToken: webhook.token,
                name: webhookCheck.name
            },
            topic: userTopic(userId)
        })
        await announceTopicRegistrationsChanged(this.dependencies.notifications, [
            userTopic(userId)
        ])
        return DiscordWebhookConnectResult.Connected
    }

    async disconnect(userId: string): Promise<void> {
        await this.unregisterWebhooks(userId)
        await announceTopicRegistrationsChanged(this.dependencies.notifications, [
            userTopic(userId)
        ])
    }

    // Posting the welcome proves the webhook takes messages, not just that it exists.
    private async checkWebhook(
        webhook: DiscordWebhookCredentials,
        user: User & { username: string }
    ): Promise<WebhookCheck> {
        try {
            const lookup = await this.dependencies.webhooks.lookup(webhook)
            if (lookup.kind !== 'found') {
                return { kind: 'rejected', result: LOOKUP_REJECTIONS[lookup.kind] }
            }

            const delivery = await this.dependencies.webhooks.execute(
                webhook,
                discordWebhookConnectedMessage(
                    {
                        frontendHost: this.frontendHost,
                        mentionUserId: this.dependencies.users.extractExternalId(
                            user,
                            ExternalAuthService.Discord
                        ),
                        locale: messageLocale(user)
                    },
                    user.username
                )
            )
            if (!delivery.ok) {
                console.error(
                    'Could not post to a new Discord webhook',
                    webhook.id,
                    delivery.status
                )
                return {
                    kind: 'rejected',
                    result: delivery.gone
                        ? DiscordWebhookConnectResult.NotFound
                        : DiscordWebhookConnectResult.Failed
                }
            }
            return { kind: 'usable', name: lookup.name }
        } catch (error) {
            console.error('Could not reach a new Discord webhook', webhook.id, error)
            return { kind: 'rejected', result: DiscordWebhookConnectResult.Failed }
        }
    }

    private async unregisterWebhooks(userId: string): Promise<void> {
        const registered = await this.dependencies.subscriptions.findNotificationSubscriptions(
            userTopic(userId)
        )
        const webhooks = registered.filter(
            (subscription): subscription is DiscordWebhookSubscription =>
                subscription.transport === TransportType.DiscordWebhook
        )
        for (const webhook of webhooks) {
            await this.dependencies.notifications.unregisterNotificationSubscription(webhook)
        }
    }
}
