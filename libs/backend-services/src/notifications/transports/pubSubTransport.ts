import { Notification } from '@tabletop/common'
import { TopicTransport, TopicTransportType } from './topicTransport.js'
import { MessagePublisher } from '../../pubsub/pubSubService.js'

export class PubSubTransport implements TopicTransport {
    type = TopicTransportType.PubSub

    constructor(private readonly publisher: MessagePublisher) {}

    async sendNotification({
        notification,
        topic
    }: {
        notification: Notification
        topic: string
    }): Promise<void> {
        await this.publisher.publishMessage({
            message: JSON.stringify(notification),
            topic
        })
    }
}
