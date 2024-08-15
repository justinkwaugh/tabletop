import { Notification } from '@tabletop/common'
import { NotificationSubscription } from '../subscriptions/notificationSubscription.js'

export enum TransportType {
    WebPush = 'webPush',
    Discord = 'discord'
}

export type NotificationResult = {
    success: boolean
    unregister: boolean
}

export interface NotificationTransport {
    type: TransportType
    sendNotification(
        subscription: NotificationSubscription,
        notification: Notification
    ): Promise<NotificationResult>
}
