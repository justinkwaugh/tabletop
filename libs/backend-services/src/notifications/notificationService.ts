import { Notification } from '@tabletop/common'
import { NotificationTransport } from './transports/notificationTransport.js'
import { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import { NotificationSubscriptionIdentifier } from './subscriptions/notificationSubscriptionIdentifier.js'

export enum NotificationChannel {
    UserPush = 'userPush', // Discord, WebPush, Email?
    AppRealtime = 'appRealtime' // Realtime listeners from web app
}

export type NotificationListener = {
    id: string
    onMessage: ({ message, topic }: { message: string; topic: string }) => Promise<void>
}

export interface NotificationService {
    addTransport(transport: NotificationTransport): void

    addRealtimeListener({
        listener,
        topic
    }: {
        listener: NotificationListener
        topic: string
    }): Promise<void>

    removeRealtimeListener({ listenerId }: { listenerId: string }): Promise<void>

    sendNotification({
        notification,
        topics,
        channels
    }: {
        notification: Notification
        topics: string[]
        channels: NotificationChannel[]
    }): Promise<void>

    registerNotificationSubscription({
        subscription,
        topic
    }: {
        subscription: NotificationSubscription
        topic: string
    }): Promise<void>

    unregisterNotificationSubscription(
        identifier: NotificationSubscriptionIdentifier
    ): Promise<void>
}
