import type { UserTopicRegistrations } from '@tabletop/common'
import type { NotificationStore } from '../persistence/stores/notificationStore.js'
import type { DiscordWebhookSubscription } from './subscriptions/discordWebhookSubscription.js'
import type { NotificationSubscription } from './subscriptions/notificationSubscription.js'
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
        const registered = await this.subscriptions.findNotificationSubscriptions(userTopic(userId))
        const webhook = registered.find(
            (subscription): subscription is DiscordWebhookSubscription =>
                subscription.transport === TransportType.DiscordWebhook
        )
        return {
            discordBot: {
                available: this.bots.discordBot,
                connected: this.bots.discordBot && this.holds(registered, TransportType.Discord)
            },
            telegram: {
                available: this.bots.telegram,
                connected: this.bots.telegram && this.holds(registered, TransportType.Telegram)
            },
            discordWebhook: webhook ? { name: webhook.name } : undefined
        }
    }

    private holds(registered: NotificationSubscription[], transport: TransportType): boolean {
        return registered.some((subscription) => subscription.transport === transport)
    }
}
