import { RedisService } from '../redis/redisService.js'
import { MessagePublisher } from './pubSubService.js'

export class RedisPublisher implements MessagePublisher {
    constructor(private readonly redisService: RedisService) {}

    async publishMessage({ message, topic }: { message: string; topic: string }): Promise<void> {
        await this.redisService.client.publish(topic, message)
    }
}
