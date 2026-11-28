import type {
    AdminTopicRegistrations,
    DiscordWebhookConnection,
    UserTopicRegistrations
} from '@tabletop/common'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'
import type { DiscordWebhookSubscription } from './subscriptions/discordWebhookSubscription.js'
import type { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import type { WebPushSubscription } from './subscriptions/webPushSubscription.js'
import { pushServiceBrowser } from './subscriptions/webPushSubscriptionPolicy.js'
import { userTopic } from './topics.js'
import { TransportType } from './transports/notificationTransport.js'

export type BotAvailability = {
    discordBot: boolean
    telegram: boolean
}

export class TopicRegistrationsService {
    constructor(
        private readonly subscriptions: Pick<NotificationStore, 'findNotificationSubscriptions'>,
        private readonly bots: BotAvailability
    ) {}

    async forUser(userId: string): Promise<UserTopicRegistrations> {
        const registered = await this.registeredFor(userId)
        return {
            discordBot: {
                available: this.bots.discordBot,
                connected: this.bots.discordBot && this.holds(registered, TransportType.Discord)
            },
            telegram: {
                available: this.bots.telegram,
                connected: this.bots.telegram && this.holds(registered, TransportType.Telegram)
            },
            discordWebhook: this.webhookConnection(registered)
        }
    }

    async forAdministrator(userId: string): Promise<AdminTopicRegistrations> {
        const registered = await this.registeredFor(userId)
        return {
            webPushBrowsers: registered
                .filter(
                    (subscription): subscription is WebPushSubscription =>
                        subscription.transport === TransportType.WebPush
                )
                .map((subscription) => pushServiceBrowser(subscription.endpoint)),
            discordBot: this.bots.discordBot && this.holds(registered, TransportType.Discord),
            telegram: this.bots.telegram && this.holds(registered, TransportType.Telegram),
            discordWebhook: this.webhookConnection(registered)
        }
    }

    private registeredFor(userId: string): Promise<NotificationSubscription[]> {
        return this.subscriptions.findNotificationSubscriptions(userTopic(userId))
    }

    private webhookConnection(
        registered: NotificationSubscription[]
    ): DiscordWebhookConnection | undefined {
        const webhook = registered.find(
            (subscription): subscription is DiscordWebhookSubscription =>
                subscription.transport === TransportType.DiscordWebhook
        )
        return webhook ? { name: webhook.name } : undefined
    }

    private holds(registered: NotificationSubscription[], transport: TransportType): boolean {
        return registered.some((subscription) => subscription.transport === transport)
    }
}
