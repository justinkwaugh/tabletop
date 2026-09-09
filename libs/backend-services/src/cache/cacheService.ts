import { Timed, measure, countTiming, startTiming } from '../diagnostics/requestTimings.js'
import {
    ClientClosedError,
    ClientOfflineError,
    ConnectionTimeoutError,
    DisconnectsClientError,
    ReconnectStrategyError,
    RedisClientPoolType,
    RedisClientType,
    SocketClosedUnexpectedlyError,
    SocketTimeoutError,
    TimeoutError,
    WatchError
} from 'redis'
import { nanoid } from 'nanoid'
import { Retryable } from 'typescript-retry-decorator'
import { RedisService } from '../redis/redisService.js'
import { CacheWriteScope, type CacheWriteLocks } from './cacheWriteScope.js'

export type { CacheWriteLocks } from './cacheWriteScope.js'

const LOCK_PREFIX = 'L:'
const READ_LOCK_PREFIX: string = `${LOCK_PREFIX}R:`
const WRITE_LOCK_PREFIX: string = `${LOCK_PREFIX}W:`
const VALUE_PREFIX = 'V:' // This prefix indicates a real cached value
const NONE_PREFIX = 'N:' // This prefix indicates a cached value representing absence

const READ_LOCK_SECONDS = 32
const WRITE_LOCK_SECONDS = 120

type PooledRedisClient = Parameters<Parameters<RedisClientPoolType['execute']>[0]>[0]

export type CacheResult = { value: unknown | undefined; cached: boolean }
export type CacheRequest = {
    key: string
    value: unknown | undefined
    lockValue: string | undefined
}
export type ReadLockRequest = { key: string; value: unknown }
export type SetValueRequest = { key: string; value: string; lockValue: string }
export type MissedValueProducer = () => Promise<unknown | undefined>
export type MissedValuesProducer = (keys: string[]) => Promise<(unknown | undefined)[]>
export type ValueWriter<T> = (locks: CacheWriteLocks) => Promise<T>

// Write markers prevent cache fills; database transactions coordinate the mutations themselves.
export class RedisCacheService {
    private client: RedisClientType
    private pool: RedisClientPoolType
    private guardPool: RedisClientPoolType

    constructor(redisService: RedisService) {
        this.client = redisService.client
        this.pool = this.client.createPool()
        this.guardPool = this.client.createPool()
        for (const pool of [this.pool, this.guardPool]) {
            pool.on('error', (error: unknown) => {
                console.error('Cache connection pool error', error)
            })
        }
    }

    public destroy(): void {
        this.pool.destroy()
        this.guardPool.destroy()
    }

    @Timed('cache.readConsistently')
    public async readConsistently<T>({
        keys,
        read,
        fallback
    }: {
        keys: string[]
        read: () => Promise<T>
        fallback: () => Promise<T>
    }): Promise<T> {
        const uniqueKeys = [...new Set(keys)]
        if (!uniqueKeys.length) throw new Error('A consistent read requires a guard key')
        let outcome: PromiseSettledResult<T> | undefined
        try {
            outcome = await this.withWatchedKeys(
                uniqueKeys,
                async (client) => {
                    const values = await measure('redis.mGet', () => client.mGet(uniqueKeys))
                    if (values.some((value) => value?.startsWith(WRITE_LOCK_PREFIX)))
                        return undefined
                    const [result] = await Promise.allSettled([Promise.resolve().then(read)])
                    await measure('redis.exec', () => client.multi().get(uniqueKeys[0]).exec())
                    return result
                },
                this.guardPool
            )
        } catch (error) {
            if (!(error instanceof WatchError) && !this.isCacheUnavailable(error)) throw error
        }
        if (outcome === undefined) {
            countTiming('cache.consistentRead.fallbacks')
            return measure('cache.consistentRead.fallback', fallback)
        }
        if (outcome.status === 'rejected') throw outcome.reason
        return outcome.value
    }

    // simple getting from the cache without any locking
    public async get<T>(key: string): Promise<{ value: T | undefined; cached: boolean }> {
        const { value, cached } = await this.cacheGet(key)
        return { value: value as T, cached }
    }

    // Simple setting into the cache without any locking
    public async set(key: string, value: unknown, forSeconds?: number): Promise<void> {
        const valueToCache = this.valueForCache(value)
        const cacheValue = valueToCache === undefined ? NONE_PREFIX : VALUE_PREFIX + valueToCache
        if (forSeconds === undefined) {
            await measure('redis.set', () => this.client.set(key, cacheValue))
        } else {
            await measure('redis.setEx', () => this.client.setEx(key, forSeconds, cacheValue))
        }
    }

    // Simple remove from the cache without any locking
    public async delete(key: string): Promise<void> {
        await measure('redis.del', () => this.client.del(key))
    }

    // This method will do a cached get, but on a miss will call the provided
    // function to produce the correct value and then will attempt to cache it
    @Timed('cache.cachingGet')
    public async cachingGet<T>(
        key: string,
        produceValue: MissedValueProducer
    ): Promise<T | undefined> {
        // Check the cache
        const { value, cached } = await this.cacheGet(key)

        // Cache hit
        if (cached) {
            return value as T
        }

        // Try to acquire a lock
        const lockValue = await this.acquireReadLock({ key, value: value })

        // Get the value from the producer
        const newValue = await produceValue()

        // Update cache
        this.cacheSet(key, newValue, lockValue).catch((error) => {
            console.log('unable to update cache', key, error)
        })

        return newValue as T
    }

    // This method will do a cached get, but on a miss will call the provided
    // function to produce the correct value and then will attempt to cache it
    @Timed('cache.cachingGetMulti')
    public async cachingGetMulti<T>(
        keys: string[],
        produceValues: MissedValuesProducer
    ): Promise<(T | undefined)[]> {
        const found = new Map<string, T>()

        // Check the cache
        const cachedData = await this.cacheGetMulti(keys)

        // Hold the results in a map for further use
        const cacheResults = new Map<string, CacheResult>()
        cachedData.forEach((result, index) => {
            if (result.cached) {
                found.set(keys[index], result.value as T)
            }
            cacheResults.set(keys[index], result)
        })

        // Get the set of missing keys
        const missingKeys = [...new Set(keys.filter((key) => !cacheResults.get(key)?.cached))]
        if (missingKeys.length > 0) {
            // And the corresponding lock values
            const lockValues = await this.acquireReadLocks(
                missingKeys.map((key) => {
                    return { key, value: cacheResults.get(key)?.value }
                })
            )

            // Get the missing values from the producer
            const missingValues = await produceValues(missingKeys)
            missingKeys.forEach((key, index) => {
                found.set(key, missingValues[index] as T)
            })

            // Update cache
            const cacheRequests = missingValues.map((value, index) => {
                return { key: missingKeys[index], value, lockValue: lockValues[index] }
            })

            // Cache the results
            this.cacheSetMulti(cacheRequests).catch((error) => {
                console.log('error setting cached results', error)
            })
        }

        return keys.map((key) => found.get(key))
    }

    // Get from the cache returning either the actual cached value or whatever
    // lock might be present for the key
    public async cacheGet(key: string): Promise<CacheResult> {
        const result = await this.readOrMiss(
            async () =>
                this.readCacheResult(await measure('redis.get', () => this.client.get(key))),
            {
                value: null,
                cached: false
            }
        )
        countTiming(result.cached ? 'cache.hits' : 'cache.misses')
        return result
    }

    // Get multiple values from the cache returning either the actual cached values or whatever
    // locks might be present for the keys
    public async cacheGetMulti(keys: string[]): Promise<CacheResult[]> {
        if (keys.length === 0) {
            return []
        }

        const results = await this.readOrMiss(
            async () =>
                (await measure('redis.mGet', () => this.client.mGet(keys))).map((value) =>
                    this.readCacheResult(value)
                ),
            keys.map(() => ({ value: null, cached: false }))
        )
        for (const result of results) countTiming(result.cached ? 'cache.hits' : 'cache.misses')
        return results
    }

    public async acquireReadLock(lockRequest: ReadLockRequest): Promise<string | undefined> {
        return (await this.acquireReadLocks([lockRequest]))[0]
    }

    public async acquireReadLocks(
        lockRequests: ReadLockRequest[]
    ): Promise<(string | undefined)[]> {
        const keys = [...new Set(lockRequests.map((request) => request.key))]
        const values = await this.tryLockReads(keys)
        const locks = new Map(keys.map((key, index) => [key, values[index]]))
        return lockRequests.map((request) => locks.get(request.key))
    }

    public async cacheSet(
        key: string,
        value: unknown | undefined,
        lockValue: string | undefined
    ): Promise<void> {
        await this.cacheSetMulti([{ key, value, lockValue }])
    }

    // Sets values into the cache using locks for consistency.
    public async cacheSetMulti(cacheRequests: CacheRequest[]): Promise<void> {
        const validRequests = cacheRequests.filter((request) => request.lockValue !== undefined)

        // Create the appropriate actual values for the cache
        const setRequests: SetValueRequest[] = validRequests.map((request) => {
            const valueToCache = this.valueForCache(request.value)
            const cacheValue =
                valueToCache === undefined ? NONE_PREFIX : VALUE_PREFIX + valueToCache
            return { key: request.key, value: cacheValue, lockValue: request.lockValue! }
        })
        await this.trySetValues(setRequests)
    }

    // This method will lock a set of keys while a writer function is executed
    @Timed('cache.lockWhileWriting')
    public async lockWhileWriting<T>(keys: string[], writer: ValueWriter<T>): Promise<T> {
        const startedAt = performance.now()
        const lockId = '.' + nanoid()
        const scope = new CacheWriteScope(
            (allKeys, previouslyOwned) => this.tryLockWrite(allKeys, lockId, previouslyOwned),
            startedAt + WRITE_LOCK_SECONDS * 1000
        )
        await scope.addKeys(keys)

        let result: T
        try {
            result = await writer(scope)
            try {
                await scope.close()
            } catch (error) {
                console.error('Cache write protection failed despite a completed writer', {
                    keys: scope.keys,
                    writerOutcome: 'completed',
                    cacheCoherence: 'unconfirmed',
                    error
                })
                return result
            }
        } catch (error) {
            await scope.close().catch(() => {})
            console.error('Cache write outcome is uncertain; retaining protection until expiry', {
                keys: scope.keys,
                writerOutcome: 'unknown',
                error
            })
            throw error
        } finally {
            if (performance.now() - startedAt >= WRITE_LOCK_SECONDS * 1000) {
                console.error('Cache write exceeded its protection lifetime', {
                    keys: scope.keys,
                    writeLockSeconds: WRITE_LOCK_SECONDS
                })
            }
        }

        try {
            await this.unlockWrite(scope.keys, lockId)
        } catch (error) {
            console.error('Cache cleanup failed after the writer completed', {
                keys: scope.keys,
                writerOutcome: 'completed',
                cacheCoherence: 'unconfirmed',
                error
            })
        }
        return result
    }

    // Increment a value in the cache
    public async incrementValue(key: string, amount?: number): Promise<void> {
        if (amount !== undefined) {
            await measure('redis.incrBy', () => this.client.incrBy(key, amount))
        } else {
            await measure('redis.incr', () => this.client.incr(key))
        }
    }

    private async withWatchedKeys<T>(
        keys: string[],
        operation: (client: PooledRedisClient) => Promise<T>,
        pool: RedisClientPoolType = this.pool
    ): Promise<T> {
        const waiting = startTiming(
            pool === this.guardPool ? 'redis.guardPool.wait' : 'redis.pool.wait'
        )
        try {
            return await pool.execute(async (client) => {
                waiting?.end()
                if (!client.isOpen) {
                    await measure('redis.connect', () => client.connect())
                }
                try {
                    if (client.isWatching) {
                        await measure('redis.unwatch', () => client.unwatch())
                    }
                    await measure('redis.watch', () => client.watch(keys))
                    return await operation(client)
                } finally {
                    try {
                        await measure('redis.unwatch', () => client.unwatch())
                    } catch (error) {
                        if (client.isOpen) {
                            client.destroy()
                        }
                        console.error('Unable to clear cache WATCH state; connection closed', error)
                    }
                }
            })
        } catch (error) {
            waiting?.end('error')
            if (error instanceof WatchError) countTiming('cache.watchConflicts')
            throw error
        }
    }

    @Timed('cache.tryLockReads')
    private async tryLockReads(keys: string[]): Promise<(string | undefined)[]> {
        if (keys.length === 0) {
            return []
        }
        try {
            return await this.withWatchedKeys(keys, async (isolatedClient) => {
                const lockValues = []
                const currentValues = await measure('redis.mGet', () => isolatedClient.mGet(keys))

                const pipeline = isolatedClient.multi()
                for (const [index, currentValue] of currentValues.entries()) {
                    if (this.isLocked(currentValue) || this.readCacheResult(currentValue).cached) {
                        lockValues.push(undefined)
                    } else {
                        const lockValue = READ_LOCK_PREFIX + nanoid()
                        pipeline.setEx(keys[index], READ_LOCK_SECONDS, lockValue)
                        lockValues.push(lockValue)
                    }
                }
                await measure('redis.exec', () => pipeline.exec())
                return lockValues
            })
        } catch (error) {
            if (error instanceof WatchError) {
                console.log('Watched keys changed before read lock could be acquired', keys)
            } else if (this.isCacheUnavailable(error)) {
                console.warn('Cache read protection unavailable; skipping cache fill', error)
            } else {
                console.log('Error acquiring read lock for keys', keys, error)
                throw error
            }
        }
        return new Array(keys.length).fill(undefined)
    }

    @Retryable({ maxAttempts: 5, value: [WatchError], useOriginalError: true })
    @Timed('cache.tryLockWrite')
    private async tryLockWrite(
        keys: string[],
        lockId: string,
        previouslyOwned: string[]
    ): Promise<void> {
        countTiming('cache.writeAcquire.attempts')
        if (keys.length === 0) {
            return
        }

        await this.withWatchedKeys(keys, async (isolatedClient) => {
            const currentValues = await measure('redis.mGet', () => isolatedClient.mGet(keys))
            const expectedOwners = new Set(previouslyOwned)
            const lockData: [string, string][] = keys.map((key, index) => {
                const owners = this.writeLockOwners(currentValues[index])
                if (expectedOwners.has(key) && !owners.has(lockId.slice(1))) {
                    throw new Error(`Cache write protection lost for key: ${key}`)
                }
                owners.add(lockId.slice(1))
                return [key, this.writeLockValue(owners)]
            })
            const transaction = isolatedClient.multi().mSet(lockData)
            for (const key of keys) {
                transaction.expire(key, WRITE_LOCK_SECONDS)
            }
            await measure('redis.exec', () => transaction.exec())
        })
    }

    @Retryable({ maxAttempts: 5, value: [WatchError], useOriginalError: true })
    @Timed('cache.unlockWrite')
    private async unlockWrite(keys: string[], lockId: string): Promise<void> {
        countTiming('cache.writeRelease.attempts')
        if (keys.length === 0) {
            return
        }

        await this.withWatchedKeys(keys, async (isolatedClient) => {
            const currentValues = await measure('redis.mGet', () => isolatedClient.mGet(keys))
            const lockData: [string, string][] = []
            const missingOwners: string[] = []
            for (const [index, currentValue] of currentValues.entries()) {
                const owners = this.writeLockOwners(currentValue)
                if (!owners.delete(lockId.slice(1))) {
                    missingOwners.push(keys[index])
                }
                if (currentValue === null) {
                    continue
                }
                const newValue = this.writeLockValue(owners)
                if (newValue !== currentValue) {
                    lockData.push([keys[index], newValue])
                }
            }
            if (missingOwners.length) {
                console.error('Cache write marker missing during cleanup', {
                    keys: missingOwners,
                    cacheCoherence: 'unconfirmed'
                })
            }
            if (lockData.length === 0) {
                return
            }
            const transaction = isolatedClient.multi().mSet(lockData)
            for (const [key, value] of lockData) {
                transaction.expire(key, value ? WRITE_LOCK_SECONDS : READ_LOCK_SECONDS)
            }
            await measure('redis.exec', () => transaction.exec())
        })
    }

    // We use an isolated context here to run a pipeline of commands to set the values only if
    // the existing lock value equals what we expect and has not changed
    @Timed('cache.trySetValues')
    private async trySetValues(setRequests: SetValueRequest[]): Promise<void> {
        if (setRequests.length === 0) {
            return
        }

        try {
            const keys = [...new Set(setRequests.map((request) => request.key))]
            await this.withWatchedKeys(keys, async (isolatedClient) => {
                const pipeline = isolatedClient.multi()
                const currentValues = await measure('redis.mGet', () => isolatedClient.mGet(keys))
                const valuesByKey = new Map(keys.map((key, index) => [key, currentValues[index]]))
                for (const request of setRequests) {
                    const currentValue = valuesByKey.get(request.key)
                    if (currentValue !== request.lockValue) {
                        continue
                    } else {
                        pipeline.set(request.key, request.value)
                    }
                }
                await measure('redis.exec', () => pipeline.exec())
            })
        } catch (error) {
            if (error instanceof WatchError) {
                console.log('Watched keys changed before set could be completed')
            } else {
                console.log('Error setting locked values', error)
                throw error
            }
        }
    }

    private isLocked(value: unknown): boolean {
        return this.isString(value) && value.startsWith(LOCK_PREFIX)
    }

    private writeLockOwners(value: string | null): Set<string> {
        if (!value?.startsWith(WRITE_LOCK_PREFIX)) {
            return new Set()
        }
        return new Set(value.slice(WRITE_LOCK_PREFIX.length).split('.').filter(Boolean))
    }

    private writeLockValue(owners: Set<string>): string {
        return owners.size
            ? WRITE_LOCK_PREFIX + [...owners].map((owner) => '.' + owner).join('')
            : ''
    }

    private readCacheResult(value: string | null): CacheResult {
        if (value === NONE_PREFIX) {
            return { value: undefined, cached: true }
        }
        if (value?.startsWith(VALUE_PREFIX)) {
            try {
                const parsedData: unknown = JSON.parse(value.slice(VALUE_PREFIX.length))
                return { value: parsedData, cached: true }
            } catch (error) {
                console.log('unable to parse cache value', value, error)
            }
        }
        return { value, cached: false }
    }

    private async readOrMiss<T>(read: () => Promise<T>, miss: T): Promise<T> {
        try {
            return await read()
        } catch (error) {
            if (!this.isCacheUnavailable(error)) throw error
            console.warn('Cache read unavailable; returning a miss', error)
            return miss
        }
    }

    private isCacheUnavailable(error: unknown): boolean {
        if (
            error instanceof ClientClosedError ||
            error instanceof ClientOfflineError ||
            error instanceof ConnectionTimeoutError ||
            error instanceof DisconnectsClientError ||
            error instanceof SocketClosedUnexpectedlyError ||
            error instanceof SocketTimeoutError ||
            error instanceof TimeoutError
        ) {
            return true
        }
        if (error instanceof ReconnectStrategyError) {
            return this.isCacheUnavailable(error.socketError)
        }
        return (
            error instanceof Error &&
            'code' in error &&
            typeof error.code === 'string' &&
            [
                'ECONNRESET',
                'ECONNREFUSED',
                'EPIPE',
                'ETIMEDOUT',
                'ENETUNREACH',
                'EHOSTUNREACH',
                'ENOTFOUND',
                'EAI_AGAIN'
            ].includes(error.code)
        )
    }

    private valueForCache(value: unknown): string | undefined {
        if (value === undefined) {
            return value
        }
        return JSON.stringify(value)
    }

    private isString(value: unknown): value is string {
        return typeof value === 'string'
    }
}
