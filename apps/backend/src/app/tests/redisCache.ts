import { RedisCacheService, RedisService, type SecretsService } from '@tabletop/backend-services'

const noCredentials: SecretsService = { getSecret: async () => '' }

// Built from the package so its request timings share the context of the stores under test
export async function connectedRedisCache() {
    const redis = await RedisService.createRedisService(noCredentials)
    const cache = new RedisCacheService(redis)
    return {
        cache,
        client: redis.client,
        close() {
            cache.destroy()
            redis.destroy()
        }
    }
}
