import { SecretsService } from '../secrets/secretsService'
import { PubSubService, PubSubSubscriber } from './pubSubService'
import { createClient, RedisClientType } from 'redis'

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

    private constructor(client: RedisClientType) {
        this.pubClient = client
        this.subClient = client.duplicate()
    }

    static async createNotificationsService(
        secretsService: SecretsService
    ): Promise<RedisPubSubService> {
        const client = await this.createClient(secretsService)
        const service = new RedisPubSubService(client)
        await service.initialize()
        return service
    }

    static async createClient(secretsService: SecretsService): Promise<RedisClientType> {
        const redisHost = process.env['REDIS_HOST'] || 'localhost'
        const redisPort = Number(process.env['REDIS_PORT'] ?? '6379')

        const redisUsername = await secretsService.getSecret('REDIS_USERNAME')
        const redisPassword = await secretsService.getSecret('REDIS_PASSWORD')

        return createClient({
            username: redisUsername,
            password: redisPassword,
            socket: {
                host: redisHost,
                port: redisPort
            }
        })
    }

    private async initialize(): Promise<void> {
        console.log(`Initializing RedisPubSubService`)
        this.pubClient.on('error', (err) => console.log('Redis publisher error:', err))
        this.pubClient.on('connect', () => console.log('Redis publisher connected'))
        this.pubClient.on('ready', () => console.log('Redis publisher ready'))
        this.pubClient.on('end', () => console.log('Redis publisher has ended its connection'))
        this.pubClient.on('reconnecting', () => console.log('Redis publisher is reconnecting'))

        this.subClient.on('error', (err) => console.log('Redis subscriber error:', err))
        this.subClient.on('connect', () => console.log('Redis subscriber connected'))
        this.subClient.on('ready', () => console.log('Redis subscriber ready'))
        this.subClient.on('end', () => console.log('Redis subscriber has ended its connection'))
        this.subClient.on('reconnecting', () => console.log('Redis subscriber is reconnecting'))

        await this.pubClient.connect()
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
