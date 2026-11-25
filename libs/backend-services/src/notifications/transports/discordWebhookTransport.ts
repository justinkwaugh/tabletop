import { ExternalAuthService, isUserNotification, Notification } from '@tabletop/common'

import type { DiscordWebhookApi } from '../../discord/discordWebhookApi.js'
import type { UserService } from '../../users/userService.js'
import type { Locale } from '@tabletop/email/i18n'
import { DiscordWebhookSubscription } from '../subscriptions/discordWebhookSubscription.js'
import { discordWebhookNotificationMessage } from './discordWebhookNotificationMessage.js'
import { NotificationCatalog, notificationCatalogEntry } from './notificationCatalogEntry.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'

export class DiscordWebhookTransport implements NotificationTransport {
    type = TransportType.DiscordWebhook

    constructor(
        private readonly catalog: NotificationCatalog,
        private readonly webhooks: Pick<DiscordWebhookApi, 'execute'>,
        private readonly users: Pick<UserService, 'getUser' | 'extractExternalId'>,
        private readonly frontendHost: string
    ) {}

    async sendNotification(
        subscription: DiscordWebhookSubscription,
        notification: Notification,
        locale: Locale
    ): Promise<NotificationResult> {
        if (!isUserNotification(notification)) {
            return { success: false, unregister: false }
        }

        const [catalogEntry, user] = await Promise.all([
            notificationCatalogEntry(this.catalog, notification.data.game.typeId),
            this.users.getUser(subscription.userId)
        ])
        const delivery = await this.webhooks.execute(
            { id: subscription.webhookId, token: subscription.webhookToken },
            discordWebhookNotificationMessage(notification, {
                frontendHost: this.frontendHost,
                gameTitle: catalogEntry?.metadata.name,
                mentionUserId: user
                    ? this.users.extractExternalId(user, ExternalAuthService.Discord)
                    : undefined,
                locale
            })
        )
        if (delivery.ok) {
            return { success: true, unregister: false }
        }

        console.error(
            'Could not post a Discord webhook notification',
            subscription.webhookId,
            delivery.status
        )
        return { success: false, unregister: delivery.gone }
    }
}
