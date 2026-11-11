import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient, type RedisClientType } from 'redis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalRateLimitCounter, RedisRateLimitCounter } from './rateLimitCounter.js'

describe('LocalRateLimitCounter', () => {
    afterEach(() => vi.useRealTimers())

    it('counts within a window and starts over when it expires', async () => {
        vi.useFakeTimers()
        const counter = new LocalRateLimitCounter()
        expect(await counter.increment('a', 1000)).toEqual({ current: 1, ttlMs: 1000 })
        vi.advanceTimersByTime(400)
        expect(await counter.increment('a', 1000)).toEqual({ current: 2, ttlMs: 600 })
        expect(await counter.increment('b', 1000)).toEqual({ current: 1, ttlMs: 1000 })
        vi.advanceTimersByTime(600)
        expect(await counter.increment('a', 1000)).toEqual({ current: 1, ttlMs: 1000 })
    })

    it('drops expired windows first and then the oldest when full', async () => {
        vi.useFakeTimers()
        const counter = new LocalRateLimitCounter(3)
        await counter.increment('expired', 100)
        vi.advanceTimersByTime(200)
        await counter.increment('old', 1000)
        await counter.increment('newer', 1000)
        await counter.increment('newest', 1000)
        expect(await counter.increment('expired', 1000)).toEqual({ current: 1, ttlMs: 1000 })
        expect(await counter.increment('newer', 1000)).toEqual({ current: 2, ttlMs: 1000 })
        expect(await counter.increment('newest', 1000)).toEqual({ current: 2, ttlMs: 1000 })
        expect(await counter.increment('old', 1000)).toEqual({ current: 1, ttlMs: 1000 })
    })
})

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST)('RedisRateLimitCounter against Redis', () => {
    let client: RedisClientType
    let prefix: string

    function connect(disableOfflineQueue = false): RedisClientType {
        return createClient({
            disableOfflineQueue,
            socket: {
                host: process.env.CACHE_TEST_REDIS_HOST,
                port: Number(process.env.CACHE_TEST_REDIS_PORT ?? 6379),
                reconnectStrategy: false
            }
        })
    }

    beforeEach(async () => {
        client = connect()
        await client.connect()
        prefix = `rate-limit-counter-test:${randomUUID()}:`
    })

    afterEach(async () => {
        const keys: string[] = []
        for await (const batch of client.scanIterator({ MATCH: `${prefix}*` })) keys.push(...batch)
        if (keys.length) await client.del(keys)
        client.destroy()
    })

    it('shares one window across counters on different connections', async () => {
        const other = connect()
        await other.connect()
        try {
            const first = new RedisRateLimitCounter(client)
            const second = new RedisRateLimitCounter(other)
            expect(await first.increment(`${prefix}a`, 60_000)).toEqual({
                current: 1,
                ttlMs: 60_000
            })
            const next = await second.increment(`${prefix}a`, 60_000)
            expect(next.current).toBe(2)
            expect(next.ttlMs).toBeGreaterThan(59_000)
            expect(next.ttlMs).toBeLessThanOrEqual(60_000)
        } finally {
            other.destroy()
        }
    })

    it('increments atomically under concurrency', async () => {
        const counter = new RedisRateLimitCounter(client)
        const counts = await Promise.all(
            Array.from({ length: 100 }, () => counter.increment(`${prefix}burst`, 60_000))
        )
        expect(new Set(counts.map((count) => count.current)).size).toBe(100)
        expect(Math.max(...counts.map((count) => count.current))).toBe(100)
    })

    it('starts a fresh window once the key expires', async () => {
        const counter = new RedisRateLimitCounter(client)
        await counter.increment(`${prefix}expiring`, 60_000)
        await counter.increment(`${prefix}expiring`, 60_000)
        await client.pExpire(`${prefix}expiring`, 1)
        await delay(10)
        expect(await counter.increment(`${prefix}expiring`, 60_000)).toEqual({
            current: 1,
            ttlMs: 60_000
        })
    })

    it('counts per process while the cache is unavailable and reports the outage once', async () => {
        const offline = connect(true)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        try {
            const counter = new RedisRateLimitCounter(offline)
            expect((await counter.increment(`${prefix}offline`, 60_000)).current).toBe(1)
            expect((await counter.increment(`${prefix}offline`, 60_000)).current).toBe(2)
            expect(counter.degraded).toBe(true)
            expect(warn).toHaveBeenCalledTimes(1)
            expect(await client.exists(`${prefix}offline`)).toBe(0)
        } finally {
            warn.mockRestore()
        }
    })
})
