import { vi } from 'vitest'
import { createClient, type RedisClientType } from 'redis'
import { RedisCacheService } from '../cacheService.js'
import { RedisService } from '../../redis/redisService.js'

export function cacheFixture(client: RedisClientType = createClient()) {
    const pool = client.createPool({ minimum: 1, maximum: 1 })
    const guardPool = client.createPool({ minimum: 1, maximum: 1 })
    vi.spyOn(client, 'createPool').mockReturnValueOnce(pool).mockReturnValueOnce(guardPool)
    const redis: RedisService = Object.create(RedisService.prototype)
    Object.defineProperty(redis, 'client', { value: client })
    const cache = new RedisCacheService(redis)
    return { cache, client, pool, guardPool }
}
