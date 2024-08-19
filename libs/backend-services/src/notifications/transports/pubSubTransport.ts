import { Notification } from '@tabletop/common'
import { TopicTransport, TopicTransportType } from './topicTransport.js'
import { PubSubService } from '../../pubsub/pubSubService.js'

export class PubSubTransport implements TopicTransport {
    type = TopicTransportType.PubSub

    constructor(private readonly pubSubService: PubSubService) {}

    async sendNotification({
        notification,
        topic
    }: {
        notification: Notification
        topic: string
    }): Promise<void> {
        await this.pubSubService.publishMessage({
            message: JSON.stringify(notification),
            topic
        })
    }
}
