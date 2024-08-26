import { RedisService } from '../redis/redisService.js'
import { PubSubService, PubSubSubscriber } from './pubSubService.js'
import { RedisClientType } from 'redis'

type SubscriberEntry = {
    subscriber: PubSubSubscriber
    listener: (message: string, channel: string) => void
    topics: Set<string>
    patternTopics: Set<string>
}

export class RedisPubSubService implements PubSubService {
    private subscribersById: Record<string, SubscriberEntry> = {}

    private pubClient: RedisClientType
    private subClient: RedisClientType

    private constructor(redisService: RedisService) {
        this.pubClient = redisService.client
        this.subClient = this.pubClient.duplicate()
    }

    static async createPubSubService(redisService: RedisService): Promise<RedisPubSubService> {
        const service = new RedisPubSubService(redisService)
        await service.initialize()
        return service
    }

    private async initialize(): Promise<void> {
        console.log(`Initializing RedisPubSubService`)
        await this.subClient.connect()
    }

    async publishMessage({ message, topic }: { message: string; topic: string }): Promise<void> {
        await this.pubClient.publish(topic, message)
    }

    async subscribeToTopics({
        topics,
        subscriber
    }: {
        topics: string[]
        subscriber: PubSubSubscriber
    }): Promise<void> {
        console.log(`Adding subscriber ${subscriber.id} for topics ${topics}`)

        const subscriberEntry = this.upsertSubscriberEntry(subscriber)

        const newTopics = new Set<string>()
        topics.forEach((topic) => {
            if (!subscriberEntry.topics.has(topic)) {
                newTopics.add(topic)
                subscriberEntry.topics.add(topic)
            }
        })

        if (newTopics.size > 0) {
            console.log(
                `Adding redis pubsub subscription for subscriber ${subscriber.id} for topics ${newTopics}`
            )
            await this.subClient.subscribe(Array.from(newTopics), subscriberEntry.listener)
        }
    }

    async subscribeToTopicPatterns({
        topics,
        subscriber
    }: {
        topics: string[]
        subscriber: PubSubSubscriber
    }): Promise<void> {
        console.log(`Adding subscriber ${subscriber.id} for pattern topics ${topics}`)
        const subscriberEntry = this.upsertSubscriberEntry(subscriber)

        const newTopics = new Set<string>()
        topics.forEach((topic) => {
            if (!subscriberEntry.patternTopics.has(topic)) {
                newTopics.add(topic)
                subscriberEntry.patternTopics.add(topic)
            }
        })

        if (newTopics.size > 0) {
            console.log(
                `Adding redis pubsub subscription for subscriber ${subscriber.id} for pattern topics ${newTopics}`
            )
            await this.subClient.pSubscribe(Array.from(newTopics), subscriberEntry.listener)
        }
    }

    private upsertSubscriberEntry(subscriber: PubSubSubscriber): SubscriberEntry {
        let subscriberEntry = this.subscribersById[subscriber.id]
        if (!subscriberEntry) {
            subscriberEntry = {
                subscriber,
                listener: (message, channel) => subscriber.onMessage({ message, topic: channel }),
                topics: new Set(),
                patternTopics: new Set()
            }
            this.subscribersById[subscriber.id] = subscriberEntry
        }
        return subscriberEntry
    }

    async unsubscribe({ subscriberId }: { subscriberId: string }): Promise<void> {
        await this.initialize()
        const subscriberEntry = this.subscribersById[subscriberId]
        if (!subscriberEntry) {
            return
        }

        delete this.subscribersById[subscriberId]

        if (subscriberEntry.topics.size > 0) {
            await this.subClient.unsubscribe([...subscriberEntry.topics], subscriberEntry.listener)
        }

        if (subscriberEntry.patternTopics.size > 0) {
            await this.subClient.pUnsubscribe(
                [...subscriberEntry.patternTopics],
                subscriberEntry.listener
            )
        }
    }
}
