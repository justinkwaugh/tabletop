import { PubSubService, PubSubSubscriber } from '../pubsub/pubSubService.js'
import { Notification } from '@tabletop/common'
import { NotificationStore } from '../persistence/stores/notificationStore.js'
import {
    NotificationChannel,
    NotificationListener,
    NotificationService
} from './notificationService.js'
import { NotificationTransport } from './transports/notificationTransport.js'
import { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import { NotificationSubscriptionIdentifier } from './subscriptions/notificationSubscriptionIdentifier.js'

export class DefaultNotificationService implements NotificationService {
    private transports: Record<string, NotificationTransport> = {}

    private rtListenersById: Record<string, NotificationListener> = {}
    private rtListenersByTopic: Record<string, Set<string>> = {}

    private pubSubSubscriber: PubSubSubscriber = {
        id: 'notifications-service', // Need better id probably
        onMessage: async ({ message, topic }) => {
            await this.notifyRealtimeListeners({ topic, notification: message })
        }
    }

    private constructor(
        private readonly notificationStore: NotificationStore,
        private readonly pubSubService: PubSubService
    ) {}

    static async createNotificationService(
        notificationStore: NotificationStore,
        pubSubService: PubSubService
    ): Promise<NotificationService> {
        const service = new DefaultNotificationService(notificationStore, pubSubService)
        await service.initialize()
        return service
    }

    private async initialize(): Promise<void> {
        await this.pubSubService.subscribeToTopics({
            topics: ['global'],
            subscriber: this.pubSubSubscriber
        })
        await this.pubSubService.subscribeToTopicPatterns({
            topics: ['user-*', 'game-*'],
            subscriber: this.pubSubSubscriber
        })
    }

    addTransport(transport: NotificationTransport) {
        this.transports[transport.type] = transport
    }

    async addRealtimeListener({
        listener,
        topic
    }: {
        listener: NotificationListener
        topic: string
    }) {
        this.rtListenersById[listener.id] = listener

        if (!this.rtListenersByTopic[topic]) {
            this.rtListenersByTopic[topic] = new Set()
        }
        this.rtListenersByTopic[topic].add(listener.id)
    }

    async removeRealtimeListener({ listenerId }: { listenerId: string }) {
        const listener = this.rtListenersById[listenerId]
        if (!listener) {
            return
        }

        for (const topic of Object.keys(this.rtListenersByTopic)) {
            this.rtListenersByTopic[topic].delete(listenerId)
        }

        delete this.rtListenersById[listenerId]
    }

    async sendNotification({
        notification,
        topics,
        channels
    }: {
        notification: Notification
        topics: string[]
        channels: NotificationChannel[]
    }) {
        for (const topic of topics) {
            if (channels.includes(NotificationChannel.AppRealtime)) {
                try {
                    await this.pubSubService.publishMessage({
                        message: JSON.stringify(notification),
                        topic: topic
                    })
                } catch (e) {
                    console.log('Error sending notification', e)
                }
            }

            if (channels.includes(NotificationChannel.UserPush)) {
                try {
                    const subscriptions =
                        await this.notificationStore.findNotificationSubscriptions(topic)
                    for (const subscription of subscriptions) {
                        const transport = this.transports[subscription.transport]
                        try {
                            const result = await transport.sendNotification(
                                subscription,
                                notification
                            )
                            console.log('Push Result', JSON.stringify(result))

                            if (result.unregister) {
                                await this.notificationStore.deleteNotificationSubscription(
                                    subscription
                                )
                            }
                        } catch (e) {
                            console.log('Error sending web push notification', e)
                        }
                    }
                } catch (e) {
                    console.log('Error sending notification', e)
                }
            }
        }
    }

    async registerNotificationSubscription({
        subscription,
        topic
    }: {
        subscription: NotificationSubscription
        topic: string
    }) {
        await this.notificationStore.upsertNotificationSubscription({ subscription, topic })
    }

    async unregisterNotificationSubscription(identifier: NotificationSubscriptionIdentifier) {
        await this.notificationStore.deleteNotificationSubscription(identifier)
    }

    private async notifyRealtimeListeners({
        topic,
        notification
    }: {
        topic: string
        notification: string
    }) {
        const listeners = Array.from(this.rtListenersByTopic[topic] || new Set())
            .map((id) => this.rtListenersById[id])
            .filter((listener) => listener)

        for (const listener of listeners) {
            try {
                await listener.onMessage({ message: notification, topic })
            } catch (e) {
                // log error
            }
        }
    }

    async migrateNotifications(): Promise<void> {
        await this.notificationStore.migrateWebPushSubscriptions()
    }
}
