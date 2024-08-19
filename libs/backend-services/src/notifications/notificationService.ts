import { Notification } from '@tabletop/common'
import { NotificationTransport } from './transports/notificationTransport.js'
import { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import { NotificationSubscriptionIdentifier } from './subscriptions/notificationSubscriptionIdentifier.js'
import { TopicTransport } from './transports/topicTransport.js'

export enum NotificationDistributionMethod {
    UserDirect = 'userDirect', // Discord, WebPush, Email?
    Topical = 'topical' // Realtime listeners from web app
}

export type NotificationListener = {
    id: string
    onMessage: ({ message, topic }: { message: string; topic: string }) => Promise<void>
}

export interface NotificationService {
    addTopicTransport(transport: TopicTransport): void
    addTopicListener({
        listener,
        topic
    }: {
        listener: NotificationListener
        topic: string
    }): Promise<void>
    removeTopicListener({ listenerId }: { listenerId: string }): Promise<void>

    addTransport(transport: NotificationTransport): void
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

    sendNotification({
        notification,
        topics,
        channels
    }: {
        notification: Notification
        topics: string[]
        channels: NotificationDistributionMethod[]
    }): Promise<void>
}
