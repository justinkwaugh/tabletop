import { RedisClientType } from 'redis'
import { nanoid } from 'nanoid'
import { RedisService } from '../redis/redisService.js'

const LOCK_PREFIX = 'L:'
const READ_LOCK_PREFIX: string = `${LOCK_PREFIX}R:`
const WRITE_LOCK_PREFIX: string = `${LOCK_PREFIX}W:`
const VALUE_PREFIX = 'V:'
const NONE_PREFIX = 'N:'

const LOCK_TIMEOUT = 32

export type ValueProducer = () => Promise<string | undefined>
export type ValueWriter<T> = () => Promise<T>

export class RedisCacheService {
    private client: RedisClientType

    constructor(redisService: RedisService) {
        this.client = redisService.client
    }

    public async getThenCacheIfMissing(
        key: string,
        produceValue: ValueProducer
    ): Promise<string | undefined> {
        // console.log('cache get', key)
        const value = await this.client.get(key)
        // console.log('cache get value', key, value)
        // If we have a value, we can happily return it, it's a cache hit
        if (this.isCached(value)) {
            // console.log('was cached', key)
            return this.valueFromCache(value)
        }

        // Try to acquire a lock if the value is not a lock
        let lockValue: string | undefined
        if (!this.isLocked(value)) {
            // console.log('get readlock cached', key)
            lockValue = await this.tryLockRead(key)
        }

        // console.log('produce value', key)
        // Get the value from the producer
        const newValue = await produceValue()
        // console.log('produced', newValue)
        // If we could not lock, just return the produced value
        if (lockValue === undefined) {
            // console.log('no lock return', key)
            return newValue
        }
        // console.log('try to cache', key, newValue)
        // Try to set the new value
        const valueForCache = this.valueForCache(newValue)
        const cacheValue = valueForCache === undefined ? NONE_PREFIX : VALUE_PREFIX + valueForCache
        await this.trySetValue(key, lockValue, cacheValue)
        // console.log('done caching', key)
        return newValue
    }

    public async lockWhileWriting<T>(keys: string[], writer: ValueWriter<T>): Promise<T> {
        // console.log('locking while writing', keys)
        let lockId
        try {
            lockId = await this.tryLockWrite(keys)

            return await writer()
        } catch (error) {
            console.log(error)
            throw error
        } finally {
            if (lockId) {
                await this.unlockWrite(keys, lockId)
            }
        }
    }

    private async tryLockRead(key: string): Promise<string | undefined> {
        const lockValue = READ_LOCK_PREFIX + nanoid()

        try {
            return await this.client.executeIsolated(async (isolatedClient) => {
                // Watch the key to ensure it doesn't change
                await isolatedClient.watch(key)
                const currentValue = await isolatedClient.get(key)

                // If the key is locked, we can't lock it
                if (currentValue !== null && this.isLocked(currentValue)) {
                    await isolatedClient.unwatch()
                    return undefined
                }

                // Set our lock value
                await isolatedClient.multi().setEx(key, LOCK_TIMEOUT, lockValue).exec()
                return lockValue
            })
        } catch (error) {
            console.log('unable to acquire read lock for key', key, error)
        }
        return undefined
    }

    private async tryLockWrite(keys: string[]): Promise<string | undefined> {
        // We treat write locks somewhat like a semaphore... multiple writers could lock, and it will only unlock
        // when all writers have finished and unlocked.  Note that writers are not locking to write to the cache, they
        // are locking *while* they are writing to a separate store, and preventing readers from writing to the cache
        const lockId = '.' + nanoid()
        const lockValues = new Array(keys.length).fill(WRITE_LOCK_PREFIX)
        // console.log('LOCK WRITE', keys, lockId)
        try {
            return await this.client.executeIsolated(async (isolatedClient) => {
                // Watch the key to ensure it doesn't change
                // console.log('lw watch', keys)
                await isolatedClient.watch(keys)
                // console.log('lw get', keys)
                const currentValues = await isolatedClient.mGet(keys)
                // console.log('lw curr', currentValues)

                for (const [index, currentValue] of currentValues.entries()) {
                    if (currentValue && this.isWriteLocked(currentValue)) {
                        lockValues[index] += currentValue
                    }

                    lockValues[index] += lockId
                }

                // console.log('lw set', keys, lockValues)
                // Set our lock value
                try {
                    const lockData: [string, string][] = keys.map((key, index) => [
                        key,
                        lockValues[index]
                    ])
                    // console.log('lw set', keys, lockData)
                    const transaction = isolatedClient.multi().mSet(lockData)
                    for (const key of keys) {
                        transaction.expire(key, LOCK_TIMEOUT)
                    }
                    await transaction.exec()
                } catch (error) {
                    // console.log('lock value set error', error)
                }
                // console.log('lw done', keys)
                return lockId
            })
        } catch (error) {
            console.log('unable to acquire write lock for keys', keys, error)
        }
        return undefined
    }

    private async unlockWrite(keys: string[], lockId: string): Promise<void> {
        // console.log('UNLOCK WRITE', keys, lockId)
        try {
            await this.client.executeIsolated(async (isolatedClient) => {
                // console.log('ulw watch', keys)
                await isolatedClient.watch(keys)
                // console.log('ulw get', keys)
                const currentValues = await isolatedClient.mGet(keys)
                // console.log('ulw curr', currentValues)

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
                // console.log('ulw set', keys, lockData)
                const transaction = isolatedClient.multi().mSet(lockData)
                for (const key of keys) {
                    transaction.expire(key, LOCK_TIMEOUT)
                }
                await transaction.exec()
                // console.log('ulw done', keys)
            })
        } catch (error) {
            console.log('unable to unlock write lock for keys', keys, error)
        }
    }

    // Set a value, but only if the existing value is what we expect
    private async trySetValue(
        key: string,
        expectedValue: string,
        cacheValue: string
    ): Promise<void> {
        try {
            await this.client.executeIsolated(async (isolatedClient) => {
                await isolatedClient.watch(key)
                const currentValue = await isolatedClient.get(key)
                if (currentValue !== expectedValue) {
                    await isolatedClient.unwatch()
                    return
                }
                await isolatedClient.multi().set(key, cacheValue).exec()
            })
        } catch (error) {
            console.log('unable to set value for key', key, error)
        }
    }

    private isLocked(value: string | null): boolean {
        return value !== null && value.startsWith(LOCK_PREFIX)
    }

    private isWriteLocked(value: string | null): boolean {
        return value !== null && value.startsWith(WRITE_LOCK_PREFIX)
    }

    private isCached(value: string | null): value is string {
        return value !== null && (value.startsWith(VALUE_PREFIX) || value === NONE_PREFIX)
    }

    private valueFromCache(value: string): string | undefined {
        if (value === NONE_PREFIX) {
            return undefined
        }
        return value.slice(VALUE_PREFIX.length)
    }

    private valueForCache(value: unknown): string | undefined {
        if (value === undefined || typeof value === 'string' || value instanceof String) {
            return value as string | undefined
        }
        return JSON.stringify(value)
    }
}
