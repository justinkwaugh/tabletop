import { PubSubService, PubSubSubscriber } from '../pubsub/pubSubService.js'
import { assertExists, Notification } from '@tabletop/common'
import type { Locale } from '@tabletop/email/i18n'
import { NotificationStore } from '../persistence/stores/notificationStore.js'
import {
    NotificationDistributionMethod,
    NotificationListener,
    NotificationService
} from './notificationService.js'
import { NotificationTransport, TransportType } from './transports/notificationTransport.js'
import { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import { NotificationSubscriptionIdentifier } from './subscriptions/notificationSubscriptionIdentifier.js'
import { TopicTransport } from './transports/topicTransport.js'
import { announceTopicRegistrationsChanged } from './topicRegistrationsChanged.js'
import { GLOBAL_TOPIC, userTopic } from './topics.js'

export const WEB_PUSH_REGISTRATIONS_PER_TOPIC = 20

const REGISTRATION_LIMITS: Partial<Record<TransportType, number>> = {
    [TransportType.WebPush]: WEB_PUSH_REGISTRATIONS_PER_TOPIC
}

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
            topics: [GLOBAL_TOPIC],
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
        channels,
        locale
    }: {
        notification: Notification
        topics: string[]
        channels: NotificationDistributionMethod[]
        locale?: Locale
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
                assertExists(locale, 'A notification sent to a user names its language')
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
                            .sendNotification(structuredClone(subscription), notification, locale)
                            .then(async (result) => {
                                if (result.unregister) {
                                    await this.notificationStore.deleteNotificationSubscription(
                                        subscription
                                    )
                                    await announceTopicRegistrationsChanged(this, [topic])
                                }
                            })
                            .catch((e) => {
                                console.log(
                                    `Error sending a ${subscription.transport} notification`,
                                    e
                                )
                            })
                    }
                } catch (e) {
                    console.log('Error sending notification', e)
                }
            }
        }
    }

    async hasUserDirectSubscription(userId: string): Promise<boolean> {
        const subscriptions = await this.notificationStore.findNotificationSubscriptions(
            userTopic(userId)
        )
        return subscriptions.some((subscription) => subscription.transport in this.transports)
    }

    async registerNotificationSubscription({
        subscription,
        topic
    }: {
        subscription: NotificationSubscription
        topic: string
    }) {
        await this.notificationStore.upsertNotificationSubscription({
            subscription,
            topic,
            registrationLimit: REGISTRATION_LIMITS[subscription.transport]
        })
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
            } catch {
                // log error
            }
        }
    }
}
