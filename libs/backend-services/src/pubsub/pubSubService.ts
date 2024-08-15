export type PubSubSubscriber = {
    id: string
    onMessage: ({ message, topic }: { message: string; topic: string }) => Promise<void>
}

export interface PubSubService {
    publishMessage({ message, topic }: { message: string; topic: string }): Promise<void>
    subscribeToTopics({
        topics,
        subscriber
    }: {
        topics: string[]
        subscriber: PubSubSubscriber
    }): Promise<void>
    subscribeToTopicPatterns({
        topics,
        subscriber
    }: {
        topics: string[]
        subscriber: PubSubSubscriber
    }): Promise<void>

    unsubscribe({ subscriberId }: { subscriberId: string }): Promise<void>
}
