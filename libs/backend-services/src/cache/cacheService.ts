import { RedisClientType } from 'redis'
import { nanoid } from 'nanoid'
import { RedisService } from '../redis/redisService.js'

const LOCK_PREFIX = 'L:'
const READ_LOCK_PREFIX: string = `${LOCK_PREFIX}R:`
const WRITE_LOCK_PREFIX: string = `${LOCK_PREFIX}W:`
const VALUE_PREFIX = 'V:' // This prefix indicates a real cached value
const NONE_PREFIX = 'N:' // This prefix indicates a cached value representing absence

const LOCK_TIMEOUT = 32

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
export type ValueWriter<T> = () => Promise<T>

// This class provides functionality to use Redis as cache but with the necessary functionality
// to provide distributed cache consistency for use by a datastore for example.
//
// Consistency with another store is ensured by requiring readers of the cache to lock the key and
// update the cache in an atomic manner on a cache miss.  Writers to the associated store must also
// lock the keys while writing.  Write locking is reentrant and the same lock can also be held by multiple
// writers. The key will only be unlocked once the last writer is done.  To prevent errors from causing
// indefinite locking of keys the lock values written expire after a reasonable amount of time.
export class RedisCacheService {
    private client: RedisClientType

    constructor(redisService: RedisService) {
        this.client = redisService.client
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
            await this.client.set(key, cacheValue)
        } else {
            await this.client.setEx(key, forSeconds, cacheValue)
        }
    }

    // This method will do a cached get, but on a miss will call the provided
    // function to produce the correct value and then will attempt to cache it
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
        const missingKeys: string[] = keys.filter((key) => !cacheResults.get(key)?.cached)
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
        const value = await this.client.get(key)

        if (this.isCached(value)) {
            return { value: this.valueFromCache(value), cached: true }
        }

        return { value, cached: false }
    }

    // Get multiple values from the cache returning either the actual cached values or whatever
    // locks might be present for the keys
    public async cacheGetMulti(keys: string[]): Promise<CacheResult[]> {
        if (keys.length === 0) {
            return []
        }

        const values = await this.client.mGet(keys)

        return values.map((value) => {
            if (this.isCached(value)) {
                return { value: this.valueFromCache(value), cached: true }
            } else {
                return { value, cached: false }
            }
        })
    }

    public async acquireReadLock(lockRequest: ReadLockRequest): Promise<string | undefined> {
        return (await this.acquireReadLocks([lockRequest]))[0]
    }

    public async acquireReadLocks(
        lockRequests: ReadLockRequest[]
    ): Promise<(string | undefined)[]> {
        // Optimize to avoid double checks of lock value
        return await this.tryLockReads(lockRequests.map((request) => request.key))

        // // Try to acquire a lock if the value is not a lock
        // let lockValue: string | undefined
        // if (!this.isLocked(value)) {
        //     lockValue = await this.tryLockRead(key)
        // }
        // return lockValue
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
    public async lockWhileWriting<T>(keys: string[], writer: ValueWriter<T>): Promise<T> {
        // console.log('locking while writing', keys)
        let lockId
        try {
            lockId = await this.tryLockWrite(keys)
            return await writer()
        } finally {
            if (lockId) {
                await this.unlockWrite(keys, lockId)
            }
        }
    }

    // Increment a value in the cache
    public async incrementValue(key: string, amount?: number): Promise<void> {
        if (amount !== undefined) {
            await this.client.incrBy(key, amount)
        } else {
            await this.client.incr(key)
        }
    }

    // Attempt to lock a set of keys using an isolated client and watch values
    // to ensure atomic and exclusive access.  Write locks can overwrite the read
    // lock values.
    private async tryLockReads(keys: string[]): Promise<(string | undefined)[]> {
        if (keys.length === 0) {
            return []
        }
        try {
            return await this.client.executeIsolated(async (isolatedClient) => {
                const lockValues = []
                // Watch the keys to ensure they don't change
                await isolatedClient.watch(keys)

                // Grab the current values
                const currentValues = await isolatedClient.mGet(keys)

                const pipeline = isolatedClient.multi()
                for (const [index, currentValue] of currentValues.entries()) {
                    // If the key is already locked, we can't lock it, otherwise set it with expiry
                    if (currentValue !== null && this.isLocked(currentValue)) {
                        lockValues.push(undefined)
                    } else {
                        const lockValue = READ_LOCK_PREFIX + nanoid()
                        pipeline.setEx(keys[index], LOCK_TIMEOUT, lockValue)
                        lockValues.push(lockValue)
                    }
                }
                await pipeline.exec()
                return lockValues
            })
        } catch (error) {
            console.log('unable to acquire read lock for keys', keys, error)
        }
        return new Array(keys.length).fill(undefined)
    }

    private async tryLockWrite(keys: string[]): Promise<string | undefined> {
        if (keys.length === 0) {
            return undefined
        }

        // We treat write locks somewhat like a semaphore... multiple writers could lock, and it will only unlock
        // when all writers have finished and unlocked.  Note that writers are not locking to write to the cache, they
        // are locking *while* they are writing to a separate store, and preventing readers from writing to the cache
        const lockId = '.' + nanoid()
        const lockValues = new Array(keys.length).fill(WRITE_LOCK_PREFIX)

        try {
            return await this.client.executeIsolated(async (isolatedClient) => {
                // Watch the key to ensure it doesn't change
                await isolatedClient.watch(keys)
                const currentValues = await isolatedClient.mGet(keys)

                for (const [index, currentValue] of currentValues.entries()) {
                    if (currentValue && this.isWriteLocked(currentValue)) {
                        lockValues[index] += currentValue
                    }

                    lockValues[index] += lockId
                }

                // Set our lock value
                try {
                    const lockData: [string, string][] = keys.map((key, index) => [
                        key,
                        lockValues[index]
                    ])
                    const transaction = isolatedClient.multi().mSet(lockData)
                    for (const key of keys) {
                        transaction.expire(key, LOCK_TIMEOUT)
                    }
                    await transaction.exec()
                } catch (error) {
                    console.log('lock value set error', error)
                }
                return lockId
            })
        } catch (error) {
            console.log('unable to acquire write lock for keys', keys, error)
        }
        return undefined
    }

    private async unlockWrite(keys: string[], lockId: string): Promise<void> {
        if (keys.length === 0) {
            return
        }

        try {
            await this.client.executeIsolated(async (isolatedClient) => {
                await isolatedClient.watch(keys)
                const currentValues = await isolatedClient.mGet(keys)

                const newValues = new Array(keys.length).fill(null)
                for (const [index, currentValue] of currentValues.entries()) {
                    if (currentValue === null) {
                        continue
                    }

                    // Try to remove our lock id from the lock value
                    let newValue = currentValue.replace(lockId, '')

                    // If we are the last lock removed, or somewhow a value got in there that wasn't a lock, we clear the value
                    // The latter could happen if the key was flushed or expired and then a reader set a value
                    if (newValue && (newValue === WRITE_LOCK_PREFIX || !this.isLocked(newValue))) {
                        newValue = ''
                    }
                    newValues[index] = newValue
                }

                const lockData: [string, string][] = keys.map((key, index) => [
                    key,
                    newValues[index]
                ])

                // Set the new value
                const transaction = isolatedClient.multi().mSet(lockData)
                for (const key of keys) {
                    transaction.expire(key, LOCK_TIMEOUT)
                }
                await transaction.exec()
            })
        } catch (error) {
            console.log('unable to unlock write lock for keys', keys, error)
        }
    }

    // We use an isolated context here to run a pipeline of commands to set the values only if
    // the existing lock value equals what we expect and has not changed
    private async trySetValues(setRequests: SetValueRequest[]): Promise<void> {
        if (setRequests.length === 0) {
            return
        }

        try {
            await this.client.executeIsolated(async (isolatedClient) => {
                const keys = setRequests.map((request) => request.key)
                await isolatedClient.watch(keys)

                const pipeline = isolatedClient.multi()
                const currentValues = await isolatedClient.mGet(keys)
                for (const [index, currentValue] of currentValues.entries()) {
                    const request = setRequests[index]
                    if (currentValue !== request.lockValue) {
                        continue
                    } else {
                        pipeline.set(request.key, request.value)
                    }
                }
                await pipeline.exec()
            })
        } catch (error) {
            console.log('unable to set value for', setRequests, error)
        }
    }

    private isLocked(value: unknown): boolean {
        return this.isString(value) && value.startsWith(LOCK_PREFIX)
    }

    private isWriteLocked(value: unknown): boolean {
        return this.isString(value) && value.startsWith(WRITE_LOCK_PREFIX)
    }

    private isCached(value: string | null): value is string {
        return value !== null && (value.startsWith(VALUE_PREFIX) || value === NONE_PREFIX)
    }

    private valueFromCache(value: string): unknown | undefined {
        if (value === NONE_PREFIX) {
            return undefined
        }
        const data = value.slice(VALUE_PREFIX.length)
        try {
            const parsedData = JSON.parse(data)
            return parsedData
        } catch (error) {
            console.log('unable to parse cache value', value, error)
        }
        return undefined
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
