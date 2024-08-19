import { PubSubService, PubSubSubscriber } from '../pubsub/pubSubService.js'
import { Notification } from '@tabletop/common'
import { NotificationStore } from '../persistence/stores/notificationStore.js'
import {
    NotificationDistributionMethod,
    NotificationListener,
    NotificationService
} from './notificationService.js'
import { NotificationTransport } from './transports/notificationTransport.js'
import { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import { NotificationSubscriptionIdentifier } from './subscriptions/notificationSubscriptionIdentifier.js'
import { TopicTransport } from './transports/topicTransport.js'

export class DefaultNotificationService implements NotificationService {
    private transports: Record<string, NotificationTransport> = {}
    private topicTransports: Record<string, TopicTransport> = {}

    // For internal topic listeners... where we proxy the messages to the listeners via SSE or whatnot
    private rtListenersById: Record<string, NotificationListener> = {}
    private rtListenersByTopic: Record<string, Set<string>> = {}

    private pubSubSubscriber: PubSubSubscriber = {
        id: 'notifications-service', // Need better id probably
        onMessage: async ({ message, topic }) => {
            await this.notifyTopicListeners({ topic, notification: message })
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

    addTopicTransport(transport: TopicTransport) {
        this.topicTransports[transport.type] = transport
    }

    async addTopicListener({ listener, topic }: { listener: NotificationListener; topic: string }) {
        this.rtListenersById[listener.id] = listener

        if (!this.rtListenersByTopic[topic]) {
            this.rtListenersByTopic[topic] = new Set()
        }
        this.rtListenersByTopic[topic].add(listener.id)
    }

    async removeTopicListener({ listenerId }: { listenerId: string }) {
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
        channels: NotificationDistributionMethod[]
    }) {
        for (const topic of topics) {
            if (channels.includes(NotificationDistributionMethod.Topical)) {
                for (const topicTransport of Object.values(this.topicTransports)) {
                    topicTransport.sendNotification({ notification, topic }).catch((e) => {
                        console.log('Error sending topical notification', e)
                    })
                }
            }

            if (channels.includes(NotificationDistributionMethod.UserDirect)) {
                try {
                    const subscriptions =
                        await this.notificationStore.findNotificationSubscriptions(topic)
                    for (const subscription of subscriptions) {
                        const transport = this.transports[subscription.transport]
                        if (!transport) {
                            console.log('No transport found for', subscription.transport)
                            continue
                        }

                        transport
                            .sendNotification(structuredClone(subscription), notification)
                            .then(async (result) => {
                                if (result.unregister) {
                                    await this.notificationStore.deleteNotificationSubscription(
                                        subscription
                                    )
                                }
                            })
                            .catch((e) => {
                                console.log('Error sending web push notification', e)
                            })
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

    private async notifyTopicListeners({
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
}
