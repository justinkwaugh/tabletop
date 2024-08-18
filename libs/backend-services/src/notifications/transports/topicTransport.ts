import { Notification } from '@tabletop/common'

export enum TopicTransportType {
    Ably = 'ably',
    PubSub = 'pubSub'
}

export interface TopicTransport {
    type: TopicTransportType
    sendNotification({
        notification,
        topic
    }: {
        notification: Notification
        topic: string
    }): Promise<void>
}
