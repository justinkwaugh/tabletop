import { PubSubService, type PubSubSubscriber } from './pubSubService.js'
import GlobToRegexp from 'glob-to-regexp'

type SubscriberEntry = {
    subscriber: PubSubSubscriber
    topics: Set<string>
    patternTopics: Set<RegExp>
}

/**
 * A local implementation of the PubSubService that doesn't use a message broker.
 *
 * This is useful for testing and development.
 *
 */
export class LocalPubSubService implements PubSubService {
    private subscribersById: Record<string, SubscriberEntry> = {}

    async publishMessage({ message, topic }: { message: string; topic: string }): Promise<void> {
        console.log(`Publishing message on ${topic}: ${message}`)
        for (const entry of Object.values(this.subscribersById)) {
            const patternTopics = Array.from(entry.patternTopics)
            console.log(
                `Checking subscriber ${entry.subscriber.id} for topics ${entry.topics} and pattern topics ${patternTopics}`
            )
            if (entry.topics.has(topic) || patternTopics.some((pattern) => pattern.test(topic))) {
                console.log(`Delivering message to subscriber ${entry.subscriber.id}`)
                await entry.subscriber.onMessage({ message, topic })
            } else {
                console.log(`Skipping subscriber ${entry.subscriber.id}`)
            }
        }
    }

    async subscribeToTopics({
        topics,
        subscriber
    }: {
        topics: string[]
        subscriber: PubSubSubscriber
    }): Promise<void> {
        console.log(`Adding local pubsub subscriber ${subscriber.id} for topics ${topics}`)
        const topicsSet = new Set(topics)
        const subscriberEntry = this.subscribersById[subscriber.id]
        if (subscriberEntry) {
            topicsSet.forEach((topic) => subscriberEntry.topics.add(topic))
        } else {
            this.subscribersById[subscriber.id] = {
                subscriber,
                topics: topicsSet,
                patternTopics: new Set()
            }
        }
    }

    async subscribeToTopicPatterns({
        topics,
        subscriber
    }: {
        topics: string[]
        subscriber: PubSubSubscriber
    }): Promise<void> {
        console.log(`Adding local pubsub subscriber ${subscriber.id} for pattern topics ${topics}`)
        const topicsPatternSet = new Set(
            topics.map((topic) => GlobToRegexp(topic, { extended: true }))
        )

        const subscriberEntry = this.subscribersById[subscriber.id]
        if (subscriberEntry) {
            topicsPatternSet.forEach((pattern) => subscriberEntry.patternTopics.add(pattern))
        } else {
            this.subscribersById[subscriber.id] = {
                subscriber,
                topics: new Set(),
                patternTopics: topicsPatternSet
            }
        }
    }

    async unsubscribe({ subscriberId }: { subscriberId: string }): Promise<void> {
        console.log(`Removing local pubsub subscriber ${subscriberId}`)
        delete this.subscribersById[subscriberId]
    }
}
