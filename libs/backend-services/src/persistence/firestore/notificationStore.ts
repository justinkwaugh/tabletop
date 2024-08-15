import {
    CollectionReference,
    Firestore,
    PartialWithFieldValue,
    QueryDocumentSnapshot,
    Timestamp
} from '@google-cloud/firestore'
import crypto from 'crypto'

import { AlreadyExistsError, UnknownStorageError } from '../stores/errors.js'
import { BaseError } from '@tabletop/common'
import { isFirestoreError } from './errors.js'
import { NotificationStore } from '../stores/notificationStore.js'
import { WebPushSubscription } from '../../notifications/subscriptions/webPushSubscription.js'
import { StoredPushTopic } from '../model/storedPushTopic.js'
import { PushClient } from '../../notifications/pushClient.js'
import { StoredWebPushSubscription } from '../model/storedWebPushSubscription.js'
import { PushTopic } from '../../notifications/pushTopic.js'
import { NotificationSubscription } from '../../notifications/subscriptions/notificationSubscription.js'
import { StoredSubscription } from '../model/storedSubscription.js'
import { TransportType } from '../../notifications/transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from '../../notifications/subscriptions/notificationSubscriptionIdentifier.js'
import {
    WebPushSubscriptionClientData,
    WebPushTransport
} from '../../notifications/transports/webPushTransport.js'
import { Value } from '@sinclair/typebox/value'

export class FirestoreNotificationStore implements NotificationStore {
    readonly webPushSubscriptions: CollectionReference
    readonly notificationSubscriptions: CollectionReference
    readonly pushTopics: CollectionReference

    constructor(private firestore: Firestore) {
        this.webPushSubscriptions = firestore.collection('webPushSubscriptions')
        this.notificationSubscriptions = firestore
            .collection('notificationSubscriptions')
            .withConverter(notificationSubscriptionConverter)
        this.pushTopics = firestore.collection('pushTopics').withConverter(pushTopicConverter)
    }

    async deleteWebPushSubscription(endpoint: string): Promise<void> {
        const subscriptionId = this.hashString(endpoint)

        try {
            await this.webPushSubscriptions.firestore.runTransaction(async (transaction) => {
                const existingSubscription: StoredWebPushSubscription = (
                    await transaction.get(this.webPushSubscriptions.doc(subscriptionId))
                ).data() as StoredWebPushSubscription

                if (!existingSubscription) {
                    return
                }

                const pushTopicsToUpdate: StoredPushTopic[] = []

                for (const topic of existingSubscription.topics) {
                    const existingTopic: StoredPushTopic = (
                        await transaction.get(this.pushTopics.doc(topic))
                    ).data() as StoredPushTopic

                    if (existingTopic) {
                        existingTopic.clients = existingTopic.clients.filter(
                            (client) =>
                                client.id !== subscriptionId ||
                                client.type !== TransportType.WebPush
                        )
                        existingTopic.updatedAt = new Date()
                        pushTopicsToUpdate.push(existingTopic)
                    }
                }

                for (const pushTopic of pushTopicsToUpdate) {
                    transaction.set(this.pushTopics.doc(pushTopic.topic), pushTopic)
                }

                transaction.delete(this.webPushSubscriptions.doc(subscriptionId))
            })
        } catch (error) {
            this.handleError(error, subscriptionId, 'WebPushSubscription | PushTopic')
            throw Error('unreachable')
        }
    }

    async findNotificationSubscriptions(topic: string): Promise<NotificationSubscription[]> {
        const clients = await this.findClientsForTopic(topic)
        if (clients.length === 0) {
            return []
        }

        const documents = await Promise.all(
            clients.map((client) => {
                return this.notificationSubscriptions.doc(client.id).get()
            })
        )

        return documents
            .map((subscription) => subscription.data() as StoredSubscription)
            .filter((subscription) => subscription)
            .map((subscription) => {
                return JSON.parse(subscription.data) as NotificationSubscription
            })
    }

    async upsertNotificationSubscription({
        subscription,
        topic
    }: {
        subscription: NotificationSubscription
        topic: string
    }): Promise<void> {
        const subscriptionId = this.docIdForSubscription(subscription)

        try {
            await this.notificationSubscriptions.firestore.runTransaction(async (transaction) => {
                let existingTopic: StoredPushTopic = (
                    await transaction.get(this.pushTopics.doc(topic))
                ).data() as StoredPushTopic

                let topicToUpdate: StoredPushTopic | undefined
                if (!existingTopic) {
                    existingTopic = {
                        topic,
                        clients: [],
                        createdAt: new Date()
                    }
                }

                if (!existingTopic.clients.find((client) => client.id === subscriptionId)) {
                    topicToUpdate = existingTopic

                    const newClient: PushClient = {
                        id: subscriptionId,
                        type: subscription.transport // not actually needed?
                    }
                    topicToUpdate.clients.push(newClient)

                    // Clean migrated data
                    topicToUpdate.clients = topicToUpdate.clients.filter(
                        (client) => client.id !== subscription.id
                    )

                    topicToUpdate.updatedAt = new Date()
                }

                const existingSubscription: StoredSubscription = (
                    await transaction.get(this.notificationSubscriptions.doc(subscriptionId))
                ).data() as StoredSubscription

                let subscriptionToUpsert: StoredSubscription = existingSubscription
                if (!subscriptionToUpsert) {
                    // We could be very clean and remove the id and transport from the subscription
                    // before stringifying it but it's just more of a hassle
                    subscriptionToUpsert = {
                        id: subscriptionId,
                        transport: subscription.transport,
                        topics: [],
                        createdAt: new Date(),
                        data: JSON.stringify(subscription)
                    }
                }

                if (!subscriptionToUpsert.topics.includes(topic)) {
                    subscriptionToUpsert.topics.push(topic)
                }
                subscriptionToUpsert.updatedAt = new Date()

                if (topicToUpdate) {
                    transaction.set(this.pushTopics.doc(topic), topicToUpdate)
                }

                transaction.set(
                    this.notificationSubscriptions.doc(subscriptionId),
                    subscriptionToUpsert
                )
                return subscriptionToUpsert
            })
        } catch (error) {
            this.handleError(error, subscriptionId, 'StoredSubscription | PushTopic')
            throw Error('unreachable')
        }
    }

    async deleteNotificationSubscription(
        identifier: NotificationSubscriptionIdentifier
    ): Promise<void> {
        const subscriptionId = this.docIdForSubscription(identifier)

        try {
            await this.notificationSubscriptions.firestore.runTransaction(async (transaction) => {
                const existingSubscription: StoredSubscription = (
                    await transaction.get(this.notificationSubscriptions.doc(subscriptionId))
                ).data() as StoredSubscription

                if (!existingSubscription) {
                    return
                }

                const pushTopicsToUpdate: StoredPushTopic[] = []

                for (const topic of existingSubscription.topics) {
                    const existingTopic: StoredPushTopic = (
                        await transaction.get(this.pushTopics.doc(topic))
                    ).data() as StoredPushTopic

                    if (existingTopic) {
                        existingTopic.clients = existingTopic.clients.filter(
                            (client) => client.id !== subscriptionId
                        )
                        existingTopic.updatedAt = new Date()
                        pushTopicsToUpdate.push(existingTopic)
                    }
                }

                for (const pushTopic of pushTopicsToUpdate) {
                    transaction.set(this.pushTopics.doc(pushTopic.topic), pushTopic)
                }

                transaction.delete(this.notificationSubscriptions.doc(subscriptionId))
            })
        } catch (error) {
            this.handleError(error, subscriptionId, 'NotificationSubscription | PushTopic')
            throw Error('unreachable')
        }
    }

    private docIdForSubscription(identifier: NotificationSubscriptionIdentifier): string {
        return `${identifier.transport}:${identifier.id}`
    }

    private async findClientsForTopic(topic: string): Promise<PushClient[]> {
        try {
            const storedTopic = (await this.pushTopics.doc(topic).get()).data() as StoredPushTopic
            if (!storedTopic) {
                return []
            }
            return storedTopic.clients
        } catch (error) {
            this.handleError(error, topic, 'PushTopic')
            throw Error('unreachable')
        }
    }

    private hashString(data: string): string {
        const hash = crypto.createHash('sha256')
        hash.update(data)
        return hash.digest('hex')
    }

    private isValidId(id: string): boolean {
        return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
    }

    private handleError(error: unknown, id: string, type: string) {
        console.log(error)
        if (error instanceof BaseError) {
            throw error
        } else if (isFirestoreError(error) && error.code === 6) {
            // Extract the field from the error message
            const field = 'id'
            throw new AlreadyExistsError({
                type,
                id,
                field,
                cause: error instanceof Error ? error : undefined
            })
        } else {
            throw new UnknownStorageError({
                type,
                id,
                cause: error instanceof Error ? error : undefined
            })
        }
    }

    async migrateWebPushSubscriptions(): Promise<void> {
        const querySnapshot = await this.webPushSubscriptions.get()
        const docs = querySnapshot.docs.map((doc) => doc.data()) as unknown[]

        const subscriptions: { topics: string[]; subscription: WebPushSubscription }[] = docs.map(
            (doc) => {
                const topics = (doc as any).topics as string[]
                return {
                    topics,
                    subscription: WebPushTransport.webPushSubscriptionFromClientData(
                        Value.Clean(
                            WebPushSubscriptionClientData,
                            doc
                        ) as WebPushSubscriptionClientData
                    )
                }
            }
        )

        for (const { topics, subscription } of subscriptions) {
            for (const topic of topics) {
                await this.upsertNotificationSubscription({ subscription, topic })
            }
        }
    }
}

const notificationSubscriptionConverter = {
    toFirestore(storedSubscription: StoredSubscription): PartialWithFieldValue<StoredSubscription> {
        return storedSubscription
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): StoredSubscription {
        const data = snapshot.data() as StoredSubscription

        // Convert back to dates
        data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
        data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
        return data
    }
}

const pushTopicConverter = {
    toFirestore(pushTopic: PushTopic): PartialWithFieldValue<StoredPushTopic> {
        return pushTopic
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): PushTopic {
        const data = snapshot.data() as StoredPushTopic

        // Convert back to dates
        data.createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined
        data.updatedAt = data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined
        return data
    }
}
