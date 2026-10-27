import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient, type RedisClientType } from 'redis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalWindowCounter, RedisWindowCounter } from './windowCounter.js'

describe('LocalWindowCounter', () => {
    afterEach(() => vi.useRealTimers())

    it('counts within a window and starts over when it expires', async () => {
        vi.useFakeTimers()
        const counter = new LocalWindowCounter()
        expect(await counter.count('a', 1000)).toEqual({ current: 1, ttlMs: 1000 })
        vi.advanceTimersByTime(400)
        expect(await counter.count('a', 1000)).toEqual({ current: 2, ttlMs: 600 })
        expect(await counter.count('b', 1000)).toEqual({ current: 1, ttlMs: 1000 })
        vi.advanceTimersByTime(600)
        expect(await counter.count('a', 1000)).toEqual({ current: 1, ttlMs: 1000 })
    })

    it('drops expired windows first and then the oldest when full', async () => {
        vi.useFakeTimers()
        const counter = new LocalWindowCounter(3)
        await counter.count('expired', 100)
        vi.advanceTimersByTime(200)
        await counter.count('old', 1000)
        await counter.count('newer', 1000)
        await counter.count('newest', 1000)
        expect(await counter.count('expired', 1000)).toEqual({ current: 1, ttlMs: 1000 })
        expect(await counter.count('newer', 1000)).toEqual({ current: 2, ttlMs: 1000 })
        expect(await counter.count('newest', 1000)).toEqual({ current: 2, ttlMs: 1000 })
        expect(await counter.count('old', 1000)).toEqual({ current: 1, ttlMs: 1000 })
    })
})

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST)('RedisWindowCounter against Redis', () => {
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
        prefix = `window-counter-test:${randomUUID()}:`
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
            const first = new RedisWindowCounter(client)
            const second = new RedisWindowCounter(other)
            expect(await first.count(`${prefix}a`, 60_000)).toEqual({ current: 1, ttlMs: 60_000 })
            const next = await second.count(`${prefix}a`, 60_000)
            expect(next.current).toBe(2)
            expect(next.ttlMs).toBeGreaterThan(59_000)
            expect(next.ttlMs).toBeLessThanOrEqual(60_000)
        } finally {
            other.destroy()
        }
    })

    it('increments atomically under concurrency', async () => {
        const counter = new RedisWindowCounter(client)
        const counts = await Promise.all(
            Array.from({ length: 100 }, () => counter.count(`${prefix}burst`, 60_000))
        )
        expect(new Set(counts.map((count) => count.current)).size).toBe(100)
        expect(Math.max(...counts.map((count) => count.current))).toBe(100)
    })

    it('starts a fresh window once the key expires', async () => {
        const counter = new RedisWindowCounter(client)
        await counter.count(`${prefix}expiring`, 60_000)
        await counter.count(`${prefix}expiring`, 60_000)
        await client.pExpire(`${prefix}expiring`, 1)
        await delay(10)
        expect(await counter.count(`${prefix}expiring`, 60_000)).toEqual({
            current: 1,
            ttlMs: 60_000
        })
    })

    it('counts per process while the cache is unavailable and reports the outage once', async () => {
        const offline = connect(true)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        try {
            const counter = new RedisWindowCounter(offline)
            expect((await counter.count(`${prefix}offline`, 60_000)).current).toBe(1)
            expect((await counter.count(`${prefix}offline`, 60_000)).current).toBe(2)
            expect(counter.degraded).toBe(true)
            expect(warn).toHaveBeenCalledTimes(1)
            expect(await client.exists(`${prefix}offline`)).toBe(0)
        } finally {
            warn.mockRestore()
        }
    })
})
