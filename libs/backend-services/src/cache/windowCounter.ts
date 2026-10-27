import type { RedisClientType } from 'redis'
import { isCacheUnavailable } from './cacheService.js'
import { countTiming } from '../diagnostics/requestTimings.js'

export interface WindowCount {
    readonly current: number
    readonly ttlMs: number
}

export interface WindowCounter {
    count(key: string, windowMs: number): Promise<WindowCount>
}

interface LocalWindow {
    current: number
    expiresAt: number
}

export class LocalWindowCounter implements WindowCounter {
    private readonly windows = new Map<string, LocalWindow>()

    constructor(private readonly capacity = 10_000) {}

    async count(key: string, windowMs: number): Promise<WindowCount> {
        const now = Date.now()
        const open = this.windows.get(key)
        if (open && open.expiresAt > now) {
            open.current += 1
            return { current: open.current, ttlMs: open.expiresAt - now }
        }
        this.windows.delete(key)
        if (this.windows.size >= this.capacity) this.evict(now)
        this.windows.set(key, { current: 1, expiresAt: now + windowMs })
        return { current: 1, ttlMs: windowMs }
    }

    private evict(now: number): void {
        for (const [key, window] of this.windows) {
            if (window.expiresAt <= now) this.windows.delete(key)
        }
        for (const key of this.windows.keys()) {
            if (this.windows.size < this.capacity) break
            this.windows.delete(key)
        }
    }
}

// INCR and PEXPIRE run in one script so a window can never be left without an expiry.
const countInWindow = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if current == 1 or ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return {current, ttl}
`

export interface RedisWindowCounterOptions {
    timeoutMs?: number
    fallback?: WindowCounter
}

// Counts while Redis is reachable and falls back to per-process counting while it is not, so a
// cache outage narrows every budget to one instance instead of removing it or failing requests.
export class RedisWindowCounter implements WindowCounter {
    private readonly client: RedisClientType
    private readonly fallback: WindowCounter
    private unavailableSince: number | undefined

    constructor(
        client: RedisClientType,
        { timeoutMs = 250, fallback = new LocalWindowCounter() }: RedisWindowCounterOptions = {}
    ) {
        this.client = client.withCommandOptions({ timeout: timeoutMs })
        this.fallback = fallback
    }

    get degraded(): boolean {
        return this.unavailableSince !== undefined
    }

    async count(key: string, windowMs: number): Promise<WindowCount> {
        try {
            const reply = await this.client.eval(countInWindow, {
                keys: [key],
                arguments: [String(windowMs)]
            })
            this.recovered()
            return parseWindowCount(reply)
        } catch (error) {
            if (!isCacheUnavailable(error)) throw error
            this.degrade(error)
            return this.fallback.count(key, windowMs)
        }
    }

    private degrade(error: unknown): void {
        countTiming('windowCounter.fallback')
        if (this.unavailableSince !== undefined) return
        this.unavailableSince = Date.now()
        console.warn(
            'Window counter falling back to per-process counting: cache unavailable',
            error
        )
    }

    private recovered(): void {
        if (this.unavailableSince === undefined) return
        console.log(
            `Window counter back on the cache after ${Date.now() - this.unavailableSince} ms of per-process counting`
        )
        this.unavailableSince = undefined
    }
}

function parseWindowCount(reply: unknown): WindowCount {
    if (
        Array.isArray(reply) &&
        reply.length === 2 &&
        typeof reply[0] === 'number' &&
        typeof reply[1] === 'number'
    ) {
        return { current: reply[0], ttlMs: reply[1] }
    }
    throw new Error(`Unexpected window counter reply: ${JSON.stringify(reply)}`)
}
