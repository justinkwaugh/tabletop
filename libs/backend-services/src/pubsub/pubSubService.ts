export type PubSubSubscriber = {
    id: string
    onMessage: ({ message, topic }: { message: string; topic: string }) => Promise<void>
}

export interface MessagePublisher {
    publishMessage({ message, topic }: { message: string; topic: string }): Promise<void>
}

export interface PubSubService extends MessagePublisher {
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
