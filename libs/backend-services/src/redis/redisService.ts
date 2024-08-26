import { SecretsService } from '../secrets/secretsService.js'
import { createClient, RedisClientType } from 'redis'

export class RedisService {
    private constructor(readonly client: RedisClientType) {}

    static async createRedisService(secretsService: SecretsService): Promise<RedisService> {
        const client = await this.createClient(secretsService)
        const service = new RedisService(client)
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
            },
            isolationPoolOptions: {
                min: 1,
                max: 2
            }
        })
    }

    private async initialize(): Promise<void> {
        console.log(`Initializing RedisPubSubService`)
        this.client.on('error', (err) => console.log('Redis client error:', err))
        this.client.on('connect', () => console.log('Redis client connected'))
        this.client.on('ready', () => console.log('Redis client ready'))
        this.client.on('end', () => console.log('Redis client has ended its connection'))
        this.client.on('reconnecting', () => console.log('Redis client is reconnecting'))
        await this.client.connect()
    }
}
