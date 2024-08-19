import { Notification } from '@tabletop/common'
import { SecretsService } from '../../secrets/secretsService.js'
import { TopicTransport, TopicTransportType } from './topicTransport.js'
import { nanoid } from 'nanoid'
import Ably from 'ably'

export class AblyTransport implements TopicTransport {
    type = TopicTransportType.Ably
    private ably: Ably.Rest

    static async createAblyTransport(secretsService: SecretsService): Promise<AblyTransport> {
        const ablyApiKey = await secretsService.getSecret('ABLY_API_KEY')

        const transport = new AblyTransport(ablyApiKey)
        await transport.initialize()
        return transport
    }

    constructor(private readonly ablyApiKey: string) {
        this.ably = new Ably.Rest(ablyApiKey)
    }

    private async initialize(): Promise<void> {}

    async sendNotification({
        notification,
        topic
    }: {
        notification: Notification
        topic: string
    }): Promise<void> {
        const channel = this.ably.channels.get(topic)
        await channel.publish(nanoid(), JSON.stringify(notification))
    }
}
