import { Notification } from '@tabletop/common'
import type { Locale } from '@tabletop/email/i18n'
import { NotificationSubscription } from '../subscriptions/notificationSubscription.js'

export enum TransportType {
    WebPush = 'webPush',
    Discord = 'discord',
    DiscordWebhook = 'discordWebhook',
    Telegram = 'telegram'
}

export type NotificationResult = {
    success: boolean
    unregister: boolean
}

export interface NotificationTransport {
    type: TransportType
    sendNotification(
        subscription: NotificationSubscription,
        notification: Notification,
        locale: Locale
    ): Promise<NotificationResult>
}
