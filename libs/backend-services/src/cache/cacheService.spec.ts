import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { Firestore } from '@google-cloud/firestore'
import {
    ClientOfflineError,
    ConnectionTimeoutError,
    SimpleError,
    SocketClosedUnexpectedlyError,
    createClient,
    WatchError,
    type RedisClientType
} from 'redis'
import type { CacheWriteLocks } from './cacheService.js'
import { cacheFixture } from './tests/cacheFixture.js'

afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
})

function fixture() {
    const { cache, client, pool } = cacheFixture()
    vi.spyOn(pool, 'execute').mockImplementation(async (operation) => operation(client))
    vi.spyOn(client, 'isOpen', 'get').mockReturnValue(true)
    vi.spyOn(client, 'watch').mockResolvedValue('OK')
    const unwatch = vi.spyOn(client, 'unwatch').mockResolvedValue('OK')
    vi.spyOn(client, 'mGet').mockResolvedValue(['V:old'])
    const transaction = client.multi()
    vi.spyOn(client, 'multi').mockReturnValue(transaction)
    const exec = vi.spyOn(transaction, 'exec').mockResolvedValue([])
    return { cache, client, transaction, exec, unwatch }
}

describe('cache write locking', () => {
    it('retries a watch conflict before calling the datastore writer', async () => {
        const { cache, exec } = fixture()
        exec.mockRejectedValueOnce(new WatchError())
        const writer = vi.fn(async () => {
            expect(exec).toHaveBeenCalledTimes(2)
            return 'saved'
        })
        await expect(cache.lockWhileWriting(['game-lobby'], writer)).resolves.toBe('saved')
        expect(writer).toHaveBeenCalledTimes(1)
    })

    it('does not write when cache invalidation cannot be acquired', async () => {
        const { cache, exec } = fixture()
        exec.mockRejectedValue(new WatchError())
        const writer = vi.fn(async () => 'saved')
        await expect(cache.lockWhileWriting(['game-lobby'], writer)).rejects.toBeInstanceOf(
            WatchError
        )
        expect(writer).not.toHaveBeenCalled()
    })

    it('preserves the other writer without duplicating the lock prefix', async () => {
        const { cache, client, transaction } = fixture()
        vi.mocked(client.mGet).mockResolvedValue(['L:W:.other'])
        const set = vi.spyOn(transaction, 'mSet')
        await cache.lockWhileWriting(['game-lobby'], async () => {})
        expect(set.mock.calls[0]?.[0]).toEqual([
            ['game-lobby', expect.stringMatching(/^L:W:\.other\.[^.]+$/)]
        ])
    })

    it('retries cleanup against the new marker without repeating the writer', async () => {
        const { cache, client, transaction, exec } = fixture()
        vi.mocked(client.mGet)
            .mockResolvedValueOnce(['V:old'])
            .mockResolvedValueOnce(['L:R:expired-writer-reader'])
            .mockResolvedValueOnce(['L:W:.another-writer'])
        exec.mockResolvedValueOnce([]).mockRejectedValueOnce(new WatchError())
        const set = vi.spyOn(transaction, 'mSet')
        const writer = vi.fn(async () => 'saved')

        await expect(cache.lockWhileWriting(['game'], writer)).resolves.toBe('saved')

        expect(writer).toHaveBeenCalledTimes(1)
        expect(client.mGet).toHaveBeenCalledTimes(3)
        expect(set.mock.calls[1]?.[0]).toEqual([['game', '']])
        expect(set).toHaveBeenCalledTimes(2)
    })

    it('reports exhausted cleanup conflicts without repeating the writer', async () => {
        const { cache, exec } = fixture()
        exec.mockResolvedValueOnce([]).mockRejectedValue(new WatchError())
        const writer = vi.fn(async () => 'saved')
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(cache.lockWhileWriting(['game'], writer)).resolves.toBe('saved')
        expect(writer).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledWith(
            'Cache cleanup failed after the writer completed',
            expect.objectContaining({ writerOutcome: 'completed', cacheCoherence: 'unconfirmed' })
        )
    })

    it('releases WATCH state when all cleanup keys are absent', async () => {
        const { cache, client, transaction, unwatch } = fixture()
        vi.mocked(client.mGet).mockResolvedValueOnce([null]).mockResolvedValueOnce([null])
        const set = vi.spyOn(transaction, 'mSet')

        await expect(cache.lockWhileWriting(['game'], async () => 'saved')).resolves.toBe('saved')
        expect(set).toHaveBeenCalledTimes(1)
        expect(unwatch).toHaveBeenCalledTimes(2)
    })

    it('releases WATCH state on a failed read before EXEC', async () => {
        const { cache, client, exec, unwatch } = fixture()
        const failure = new Error('failed MGET')
        vi.mocked(client.mGet).mockRejectedValueOnce(failure)
        const writer = vi.fn()

        await expect(cache.lockWhileWriting(['game'], writer)).rejects.toBe(failure)
        expect(writer).not.toHaveBeenCalled()
        expect(exec).not.toHaveBeenCalled()
        expect(unwatch).toHaveBeenCalledTimes(1)
    })

    it('closes a connection if UNWATCH fails and preserves the operation error', async () => {
        const { cache, client, unwatch } = fixture()
        const failure = new Error('failed MGET')
        vi.mocked(client.mGet).mockRejectedValueOnce(failure)
        unwatch.mockRejectedValueOnce(new Error('failed UNWATCH'))
        const destroy = vi.spyOn(client, 'destroy').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(cache.lockWhileWriting(['game'], vi.fn())).rejects.toBe(failure)
        expect(destroy).toHaveBeenCalledTimes(1)
    })

    it('does not run the writer when write protection has a transport failure', async () => {
        const { cache, exec } = fixture()
        const failure = new SocketClosedUnexpectedlyError()
        exec.mockRejectedValueOnce(failure)
        const writer = vi.fn()

        await expect(cache.lockWhileWriting(['game'], writer)).rejects.toBe(failure)
        expect(writer).not.toHaveBeenCalled()
    })

    it('retains protection and preserves the original error when the writer rejects', async () => {
        const { cache, exec } = fixture()
        const failure = new Error('database outcome unknown')
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(
            cache.lockWhileWriting(['game'], async () => {
                throw failure
            })
        ).rejects.toBe(failure)
        expect(exec).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledWith(
            'Cache write outcome is uncertain; retaining protection until expiry',
            expect.objectContaining({ writerOutcome: 'unknown', error: failure })
        )
    })

    it('returns the completed writer result when cleanup has a transport failure', async () => {
        const { cache, exec } = fixture()
        const failure = new SocketClosedUnexpectedlyError()
        exec.mockResolvedValueOnce([]).mockRejectedValueOnce(failure)
        const result = { saved: true }
        const writer = vi.fn(async () => result)
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(cache.lockWhileWriting(['game'], writer)).resolves.toBe(result)
        expect(writer).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledWith(
            'Cache cleanup failed after the writer completed',
            expect.objectContaining({ writerOutcome: 'completed', error: failure })
        )
    })

    it('does not start a writer if acquisition consumed the protection lifetime', async () => {
        const { cache } = fixture()
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(120 * 1000)
        const writer = vi.fn()

        await expect(cache.lockWhileWriting(['game'], writer)).rejects.toThrow(
            'Cache write protection lifetime exceeded during acquisition'
        )
        expect(writer).not.toHaveBeenCalled()
    })

    it('reports an overdue writer when it settles without scheduling an expiry timer', async () => {
        vi.useFakeTimers()
        const { cache } = fixture()
        const started = Promise.withResolvers<void>()
        const finish = Promise.withResolvers<void>()
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})
        const pending = cache.lockWhileWriting(['game'], async () => {
            started.resolve()
            await finish.promise
            return 'saved'
        })
        await started.promise
        expect(vi.getTimerCount()).toBe(0)
        await vi.advanceTimersByTimeAsync(120 * 1000)
        expect(report).not.toHaveBeenCalled()
        finish.resolve()
        await expect(pending).resolves.toBe('saved')
        expect(report).toHaveBeenCalledWith(
            'Cache write exceeded its protection lifetime',
            expect.objectContaining({ writeLockSeconds: 120 })
        )
        expect(vi.getTimerCount()).toBe(0)
    })

    it('reports an overdue failed writer while preserving its error', async () => {
        const { cache } = fixture()
        const now = vi.spyOn(performance, 'now').mockReturnValue(0)
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})
        const failure = new Error('Database write failed')

        await expect(
            cache.lockWhileWriting(['game'], async () => {
                now.mockReturnValue(120 * 1000)
                throw failure
            })
        ).rejects.toBe(failure)
        expect(report).toHaveBeenCalledWith(
            'Cache write exceeded its protection lifetime',
            expect.objectContaining({ writeLockSeconds: 120 })
        )
    })

    it('rejects additions after the callback has finished', async () => {
        const { cache } = fixture()
        let captured: CacheWriteLocks | undefined
        await cache.lockWhileWriting([], async (locks) => {
            captured = locks
        })
        if (!captured) throw new Error('Expected write scope')
        await expect(captured.addKeys(['late'])).rejects.toThrow('Cache write scope is closed')
    })

    it('waits for a pending acquisition before releasing protection', async () => {
        const { cache, exec } = fixture()
        const acquiring = Promise.withResolvers<void>()
        const acquired = Promise.withResolvers<void>()
        exec.mockImplementationOnce(async () => {
            acquiring.resolve()
            await acquired.promise
            return []
        })
        const pending = cache.lockWhileWriting([], async (locks) => {
            void locks.addKeys(['discovered'])
        })
        await acquiring.promise
        expect(exec).toHaveBeenCalledTimes(1)
        acquired.resolve()
        await pending
        expect(exec).toHaveBeenCalledTimes(2)
    })

    it('drains pending acquisitions on writer rejection and retains their protection', async () => {
        const { cache, exec } = fixture()
        const acquiring = Promise.withResolvers<void>()
        const acquired = Promise.withResolvers<void>()
        const failure = new Error('writer failed')
        vi.spyOn(console, 'error').mockImplementation(() => {})
        exec.mockImplementationOnce(async () => {
            acquiring.resolve()
            await acquired.promise
            return []
        })
        const pending = cache.lockWhileWriting([], async (locks) => {
            void locks.addKeys(['discovered'])
            throw failure
        })
        const rejected = expect(pending).rejects.toBe(failure)
        await acquiring.promise
        acquired.resolve()
        await rejected
        expect(exec).toHaveBeenCalledTimes(1)
    })

    it('does not turn an ignored acquisition failure into a retryable completed write', async () => {
        const { cache, exec } = fixture()
        const failure = new SocketClosedUnexpectedlyError()
        exec.mockRejectedValueOnce(failure)
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(
            cache.lockWhileWriting([], async (locks) => {
                void locks.addKeys(['discovered'])
                return 'already committed'
            })
        ).resolves.toBe('already committed')
        expect(exec).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledWith(
            'Cache write protection failed despite a completed writer',
            expect.objectContaining({ writerOutcome: 'completed', error: failure })
        )
    })

    it('refuses further acquisition after the scope lifetime has elapsed', async () => {
        const { cache, exec } = fixture()
        const now = vi.spyOn(performance, 'now').mockReturnValue(0)
        vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(
            cache.lockWhileWriting([], async (locks) => {
                now.mockReturnValue(120_000)
                await locks.addKeys(['too-late'])
            })
        ).rejects.toThrow('Cache write protection lifetime exceeded during acquisition')
        expect(exec).not.toHaveBeenCalled()
    })
})

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST)('cache protocol against Redis', () => {
    let live: ReturnType<typeof cacheFixture>
    let keys: string[]

    beforeEach(async () => {
        const client: RedisClientType = createClient({
            socket: {
                host: process.env.CACHE_TEST_REDIS_HOST,
                port: Number(process.env.CACHE_TEST_REDIS_PORT ?? 6379),
                reconnectStrategy: false
            }
        })
        await client.connect()
        live = cacheFixture(client)
        keys = Array.from({ length: 3 }, () => `cache-protocol-test-${randomUUID()}`)
    })

    afterEach(async () => {
        if (live) {
            try {
                await live.client.del(keys)
            } finally {
                live.cache.destroy()
                live.client.destroy()
            }
        }
    })

    async function expire(key: string) {
        await live.client.pExpire(key, 1)
        await delay(10)
        expect(await live.client.get(key)).toBeNull()
    }

    it('revokes a newer read token when an expired writer completes', async () => {
        let token: string | undefined
        await live.cache.lockWhileWriting([keys[0]], async () => {
            await expire(keys[0])
            token = await live.cache.acquireReadLock({ key: keys[0], value: null })
            expect(token).toBeDefined()
        })

        await live.cache.cacheSet(keys[0], 'old database result', token)
        expect((await live.cache.cacheGet(keys[0])).cached).toBe(false)
    })

    it('clears an old value populated before an expired writer completes', async () => {
        await live.cache.lockWhileWriting([keys[0]], async () => {
            await expire(keys[0])
            const token = await live.cache.acquireReadLock({ key: keys[0], value: null })
            await live.cache.cacheSet(keys[0], 'old database result', token)
            expect((await live.cache.cacheGet(keys[0])).cached).toBe(true)
        })
        expect((await live.cache.cacheGet(keys[0])).cached).toBe(false)
    })

    it('does not release a newer writer after the first writer expires', async () => {
        const started = Promise.withResolvers<void>()
        const finish = Promise.withResolvers<void>()
        let laterWriter: Promise<void> | undefined
        try {
            await live.cache.lockWhileWriting([keys[0]], async () => {
                await expire(keys[0])
                laterWriter = live.cache.lockWhileWriting([keys[0]], async () => {
                    started.resolve()
                    await finish.promise
                })
                await started.promise
            })
            expect(await live.client.get(keys[0])).toMatch(/^L:W:\./)
            expect(await live.cache.acquireReadLock({ key: keys[0], value: null })).toBeUndefined()
        } finally {
            finish.resolve()
            await laterWriter
        }
        expect(await live.client.get(keys[0])).toBe('')
    })

    it('deduplicates keys and retains overlapping writer ownership', async () => {
        await live.cache.lockWhileWriting([keys[0], keys[0]], async () => {
            const first = await live.client.get(keys[0])
            expect(first?.split('.')).toHaveLength(2)
            await live.cache.lockWhileWriting([keys[0], keys[0]], async () => {
                expect((await live.client.get(keys[0]))?.split('.')).toHaveLength(3)
            })
            expect(await live.client.get(keys[0])).toBe(first)
        })
        expect(await live.client.get(keys[0])).toBe('')
    })

    it('removes duplicate copies of its owner without removing a similar owner', async () => {
        let remaining: string | undefined
        await live.cache.lockWhileWriting([keys[0]], async () => {
            const marker = await live.client.get(keys[0])
            if (!marker) throw new Error('Expected write marker')
            const owner = marker.slice('L:W:'.length)
            remaining = 'L:W:' + owner + '-other'
            await live.client.set(keys[0], marker + owner + owner + owner + '-other')
        })
        expect(await live.client.get(keys[0])).toBe(remaining)
    })

    it('handles missing markers without leaving WATCH state in the pool', async () => {
        await expect(
            live.cache.lockWhileWriting([keys[0]], async () => {
                await live.client.del(keys[0])
                return 'saved'
            })
        ).resolves.toBe('saved')
        await live.client.set(keys[0], 'changed after cleanup')
        await live.pool.execute(async (connection) => {
            expect(connection.isWatching).toBe(false)
            await connection.watch(keys[1])
            await connection.multi().set(keys[1], 'unrelated').exec()
        })
    })

    it('clears WATCH after a command failure before EXEC', async () => {
        const failure = new Error('MGET failed before EXEC')
        await live.pool.execute(async (connection) => {
            vi.spyOn(connection, 'mGet').mockRejectedValueOnce(failure)
        })
        await expect(live.cache.lockWhileWriting([keys[0]], vi.fn())).rejects.toBe(failure)
        await live.client.set(keys[0], 'changed after failed operation')
        await live.pool.execute(async (connection) => {
            expect(connection.isWatching).toBe(false)
            await connection.watch(keys[1])
            await connection.multi().set(keys[1], 'unrelated').exec()
        })
    })

    it('reconnects a discarded connection before another operation uses it', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const failure = new Error('MGET failed before EXEC')
        await live.pool.execute(async (connection) => {
            vi.spyOn(connection, 'mGet').mockRejectedValueOnce(failure)
            vi.spyOn(connection, 'unwatch').mockRejectedValueOnce(new Error('UNWATCH failed'))
        })
        await expect(live.cache.lockWhileWriting([keys[0]], vi.fn())).rejects.toBe(failure)
        await live.pool.execute(async (connection) => {
            expect(connection.isOpen).toBe(false)
        })
        await expect(live.cache.lockWhileWriting([keys[1]], async () => 'saved')).resolves.toBe(
            'saved'
        )
    })

    it('retries an actual cleanup conflict without deleting another writer', async () => {
        const writer = vi.fn(async () => {
            await live.pool.execute(async (connection) => {
                const originalMulti = connection.multi.bind(connection)
                vi.spyOn(connection, 'multi').mockImplementationOnce(() => {
                    const transaction = originalMulti()
                    const originalExec = transaction.exec.bind(transaction)
                    vi.spyOn(transaction, 'exec').mockImplementationOnce(async () => {
                        await live.client.set(keys[0], 'L:W:.survivor')
                        return originalExec()
                    })
                    return transaction
                })
            })
        })
        await live.cache.lockWhileWriting([keys[0]], writer)
        expect(writer).toHaveBeenCalledTimes(1)
        expect(await live.client.get(keys[0])).toBe('L:W:.survivor')
    })

    it('maps duplicate read requests to one token and refuses an expired token', async () => {
        const tokens = await live.cache.acquireReadLocks([
            { key: keys[0], value: null },
            { key: keys[0], value: null },
            { key: keys[1], value: null }
        ])
        expect(tokens[0]).toBeDefined()
        expect(tokens[0]).toBe(tokens[1])
        await expire(keys[1])
        await live.cache.cacheSetMulti([
            { key: keys[0], value: 'first', lockValue: tokens[0] },
            { key: keys[0], value: 'first', lockValue: tokens[1] },
            { key: keys[1], value: 'expired', lockValue: tokens[2] }
        ])
        expect(await live.cache.get(keys[0])).toEqual({ cached: true, value: 'first' })
        expect((await live.cache.cacheGet(keys[1])).cached).toBe(false)
    })

    it('repairs malformed data conditionally and retains legitimate negative entries', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        await live.client.set(keys[0], 'V:bad-json')
        await live.cache.set(keys[1], undefined)
        expect((await live.cache.cacheGet(keys[0])).cached).toBe(false)
        expect(await live.cache.cacheGet(keys[1])).toEqual({ cached: true, value: undefined })
        const token = await live.cache.acquireReadLock({ key: keys[0], value: 'V:bad-json' })
        await live.cache.cacheSet(keys[0], { repaired: true }, token)
        expect(await live.cache.get(keys[0])).toEqual({ cached: true, value: { repaired: true } })
        expect(
            await live.cache.acquireReadLock({ key: keys[0], value: 'V:bad-json' })
        ).toBeUndefined()
        expect(await live.cache.acquireReadLock({ key: keys[1], value: null })).toBeUndefined()
    })

    it('lets uncertain writes recover through expiry while preserving their markers', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const failure = new Error('database response lost')
        await expect(
            live.cache.lockWhileWriting([keys[0]], async () => {
                throw failure
            })
        ).rejects.toBe(failure)
        expect(await live.client.ttl(keys[0])).toBeGreaterThan(110)
        expect(await live.client.get(keys[0])).toMatch(/^L:W:/)
        expect(await live.cache.acquireReadLock({ key: keys[0], value: null })).toBeUndefined()

        await expire(keys[0])
        const token = await live.cache.acquireReadLock({ key: keys[0], value: null })
        await live.cache.cacheSet(keys[0], 'authoritative result after settlement', token)
        expect(await live.cache.get(keys[0])).toEqual({
            cached: true,
            value: 'authoritative result after settlement'
        })
    })

    it('keeps the longer lease for surviving writers and short expiry for a released key', async () => {
        await live.cache.lockWhileWriting([keys[0]], async () => {
            expect(await live.client.ttl(keys[0])).toBeGreaterThan(110)
            await live.cache.lockWhileWriting([keys[0]], async () => {})
            expect(await live.client.ttl(keys[0])).toBeGreaterThan(110)
        })
        expect(await live.client.ttl(keys[0])).toBeLessThanOrEqual(32)
        expect(await live.client.ttl(keys[0])).toBeGreaterThan(0)
        const token = await live.cache.acquireReadLock({ key: keys[1], value: null })
        expect(token).toBeDefined()
        expect(await live.client.ttl(keys[1])).toBeLessThanOrEqual(32)
    })

    it('acquires concurrent additions with one owner and revokes earlier fill permission', async () => {
        const token = await live.cache.acquireReadLock({ key: keys[1], value: null })
        await live.cache.lockWhileWriting([], async (locks) => {
            await Promise.all([
                locks.addKeys([keys[0], keys[1], keys[1]]),
                locks.addKeys([keys[1], keys[2]])
            ])
            const markers = await live.client.mGet(keys)
            expect(markers[0]).toMatch(/^L:W:\.[^.]+$/)
            expect(new Set(markers).size).toBe(1)
            await locks.addKeys(keys)
            expect(await live.client.mGet(keys)).toEqual(markers)
            await live.cache.cacheSet(keys[1], 'stale read', token)
            expect((await live.cache.cacheGet(keys[1])).cached).toBe(false)
        })
        expect(await live.client.mGet(keys)).toEqual(['', '', ''])
    })

    it('preserves another writer when releasing dynamically acquired keys', async () => {
        await live.cache.lockWhileWriting([keys[1]], async () => {
            const otherOwner = await live.client.get(keys[1])
            await live.cache.lockWhileWriting([keys[0]], async (locks) => {
                await locks.addKeys([keys[1], keys[2]])
                expect((await live.client.get(keys[1]))?.split('.')).toHaveLength(3)
            })
            expect(await live.client.get(keys[1])).toBe(otherOwner)
            expect(await live.client.mGet([keys[0], keys[2]])).toEqual(['', ''])
        })
    })

    it('refuses to extend a scope whose previous ownership was lost', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(
            live.cache.lockWhileWriting([keys[0]], async (locks) => {
                await expire(keys[0])
                await locks.addKeys([keys[1]])
            })
        ).rejects.toThrow('Cache write protection lost for key')
        expect(await live.client.mGet(keys)).toEqual([null, null, null])
    })

    it('retains the full possibly acquired union when an acquisition response is lost', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const failure = new SocketClosedUnexpectedlyError()
        await expect(
            live.cache.lockWhileWriting([keys[0]], async (locks) => {
                await live.pool.execute(async (connection) => {
                    const originalMulti = connection.multi.bind(connection)
                    vi.spyOn(connection, 'multi').mockImplementationOnce(() => {
                        const transaction = originalMulti()
                        const originalExec = transaction.exec.bind(transaction)
                        vi.spyOn(transaction, 'exec').mockImplementationOnce(async () => {
                            await originalExec()
                            throw failure
                        })
                        return transaction
                    })
                })
                await expect(locks.addKeys([keys[1]])).rejects.toBe(failure)
                await locks.addKeys([keys[2]])
            })
        ).rejects.toBe(failure)
        const markers = await live.client.mGet(keys)
        expect(markers[0]).toMatch(/^L:W:\.[^.]+$/)
        expect(markers[1]).toBe(markers[0])
        expect(markers[2]).toBeNull()
    })

    describe('consistent reads', () => {
        it('returns a stable cached read without fallback or nested-pool deadlock', async () => {
            const fallback = vi.fn(async () => 'fallback')
            const result = await live.cache.readConsistently({
                keys: [keys[0]],
                read: () => live.cache.cachingGet(keys[1], async () => 'database value'),
                fallback
            })
            expect(result).toBe('database value')
            await vi.waitFor(async () =>
                expect((await live.cache.cacheGet(keys[1])).cached).toBe(true)
            )
            expect(fallback).not.toHaveBeenCalled()
        })

        it('skips the optimistic read when a writer is already active', async () => {
            const read = vi.fn(async () => 'unsafe')
            const fallback = vi.fn(async () => 'snapshot')
            await live.cache.lockWhileWriting([keys[0]], async () => {
                expect(await live.cache.readConsistently({ keys: [keys[0]], read, fallback })).toBe(
                    'snapshot'
                )
            })
            expect(read).not.toHaveBeenCalled()
            expect(fallback).toHaveBeenCalledTimes(1)
        })

        it('detects a completed write even when the key returns to the same bytes', async () => {
            await live.client.set(keys[0], '')
            const read = vi.fn(async () => {
                await live.cache.lockWhileWriting([keys[0]], async () => {})
                return 'mixed'
            })
            const fallback = vi.fn(async () => 'snapshot')
            expect(await live.cache.readConsistently({ keys: [keys[0]], read, fallback })).toBe(
                'snapshot'
            )
            expect(read).toHaveBeenCalledTimes(1)
            expect(fallback).toHaveBeenCalledTimes(1)
            expect(await live.client.get(keys[0])).toBe('')
        })

        it('watches every requested key but ignores unrelated writes', async () => {
            const fallback = vi.fn(async () => 'snapshot')
            expect(
                await live.cache.readConsistently({
                    keys: [keys[0], keys[0], keys[1]],
                    read: async () => {
                        await live.client.set(keys[2], 'unrelated')
                        return 'stable'
                    },
                    fallback
                })
            ).toBe('stable')
            expect(fallback).not.toHaveBeenCalled()
            expect(
                await live.cache.readConsistently({
                    keys: [keys[0], keys[1]],
                    read: async () => {
                        await live.client.set(keys[1], 'changed')
                        return 'mixed'
                    },
                    fallback
                })
            ).toBe('snapshot')
            expect(fallback).toHaveBeenCalledTimes(1)
        })

        it('falls back when a guard key expires during the read', async () => {
            await live.client.set(keys[0], 'revision')
            const fallback = vi.fn(async () => 'snapshot')
            expect(
                await live.cache.readConsistently({
                    keys: [keys[0]],
                    read: async () => {
                        await expire(keys[0])
                        return 'mixed'
                    },
                    fallback
                })
            ).toBe('snapshot')
        })

        it('discards an error from a changing read but preserves an error from a stable read', async () => {
            const failure = new Error('inconsistent history')
            const fallback = vi.fn(async () => 'snapshot')
            await expect(
                live.cache.readConsistently({
                    keys: [keys[0]],
                    read: async () => {
                        throw failure
                    },
                    fallback
                })
            ).rejects.toBe(failure)
            expect(fallback).not.toHaveBeenCalled()
            expect(
                await live.cache.readConsistently({
                    keys: [keys[0]],
                    read: async () => {
                        await live.client.set(keys[0], 'changed')
                        throw failure
                    },
                    fallback
                })
            ).toBe('snapshot')
        })

        it('falls back on guard transport failure and preserves fallback errors', async () => {
            await live.guardPool.execute(async (connection) => {
                vi.spyOn(connection, 'mGet').mockRejectedValueOnce(
                    new SocketClosedUnexpectedlyError()
                )
            })
            const read = vi.fn(async () => 'unsafe')
            const failure = new Error('database unavailable')
            const fallback = vi.fn(async () => {
                throw failure
            })
            await expect(
                live.cache.readConsistently({ keys: [keys[0]], read, fallback })
            ).rejects.toBe(failure)
            expect(read).not.toHaveBeenCalled()
            expect(fallback).toHaveBeenCalledTimes(1)
        })

        it('falls back when final guard validation loses its response', async () => {
            await live.guardPool.execute(async (connection) => {
                const multi = connection.multi.bind(connection)
                vi.spyOn(connection, 'multi').mockImplementationOnce(() => {
                    const transaction = multi()
                    vi.spyOn(transaction, 'exec').mockRejectedValueOnce(
                        new SocketClosedUnexpectedlyError()
                    )
                    return transaction
                })
            })
            const fallback = vi.fn(async () => 'snapshot')
            expect(
                await live.cache.readConsistently({
                    keys: [keys[0]],
                    read: async () => 'uncertain',
                    fallback
                })
            ).toBe('snapshot')
            await live.guardPool.execute(async (connection) =>
                expect(connection.isWatching).toBe(false)
            )
        })
    })

    describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Firestore writer scope', () => {
        let db: Firestore

        beforeEach(() => {
            db = new Firestore({ projectId: 'demo-tabletop' })
        })

        afterEach(async () => {
            await db.doc(`cacheScopeTests/${keys[0]}`).delete()
            await db.terminate()
        })

        it('retains dependencies from every attempt until the transaction commits', async () => {
            const document = db.doc(`cacheScopeTests/${keys[0]}`)
            await document.set({ member: keys[1], result: 'before' })
            let attempts = 0
            await live.cache.lockWhileWriting([keys[0]], async (locks) => {
                await db.runTransaction(async (transaction) => {
                    attempts++
                    if (attempts === 2) await document.update({ member: keys[2] })
                    const snapshot = await transaction.get(document)
                    const member: unknown = snapshot.get('member')
                    if (typeof member !== 'string') throw new Error('Expected member key')
                    await locks.addKeys([member])
                    transaction.update(document, { result: 'after' })
                    if (attempts === 1) {
                        throw Object.assign(new Error('synthetic transaction conflict'), {
                            code: 10
                        })
                    }
                    expect(new Set(await live.client.mGet(keys)).size).toBe(1)
                    expect((await document.get()).get('result')).toBe('before')
                })
                expect((await document.get()).get('result')).toBe('after')
                for (const marker of await live.client.mGet(keys)) {
                    expect(marker).toMatch(/^L:W:\.[^.]+$/)
                }
            })
            expect(attempts).toBe(2)
            expect(await live.client.mGet(keys)).toEqual(['', '', ''])
        }, 20_000)

        it('aborts the database transaction when additional protection cannot be acquired', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {})
            const document = db.doc(`cacheScopeTests/${keys[0]}`)
            await document.set({ result: 'before' })
            const failure = new SocketClosedUnexpectedlyError()
            await expect(
                live.cache.lockWhileWriting([keys[0]], async (locks) => {
                    await db.runTransaction(async (transaction) => {
                        await transaction.get(document)
                        transaction.update(document, { result: 'must not commit' })
                        await live.pool.execute(async (connection) => {
                            vi.spyOn(connection, 'mGet').mockRejectedValueOnce(failure)
                        })
                        await locks.addKeys([keys[1]])
                    })
                })
            ).rejects.toBe(failure)
            expect((await document.get()).get('result')).toBe('before')
            expect(await live.client.get(keys[0])).toMatch(/^L:W:\.[^.]+$/)
            expect(await live.client.get(keys[1])).toBeNull()
        }, 20_000)
    })
})

describe('cache misses', () => {
    it('distinguishes malformed JSON from a cached absence for single and batch reads', async () => {
        const { cache, client } = fixture()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(client, 'get').mockResolvedValue('V:bad-json')
        vi.mocked(client.mGet).mockResolvedValue(['V:bad-json', 'N:', 'V:null'])

        expect(await cache.cacheGet('broken')).toEqual({ cached: false, value: 'V:bad-json' })
        expect(await cache.cacheGetMulti(['broken', 'absent', 'null'])).toEqual([
            { cached: false, value: 'V:bad-json' },
            { cached: true, value: undefined },
            { cached: true, value: null }
        ])
    })

    it('does not overwrite a fresh value published after a cache miss', async () => {
        const { cache, client, transaction } = fixture()
        vi.mocked(client.mGet).mockResolvedValue(['V:"fresh"'])
        const set = vi.spyOn(transaction, 'setEx')

        expect(await cache.acquireReadLock({ key: 'game', value: null })).toBeUndefined()
        expect(set).not.toHaveBeenCalled()
    })

    it('allows malformed data to be replaced through a read token', async () => {
        const { cache, client, transaction } = fixture()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.mocked(client.mGet).mockResolvedValue(['V:bad-json'])
        const set = vi.spyOn(transaction, 'setEx')

        const token = await cache.acquireReadLock({ key: 'game', value: 'V:bad-json' })
        expect(token).toMatch(/^L:R:/)
        expect(set).toHaveBeenCalledWith('game', 32, token)
    })

    it.each([
        new ClientOfflineError(),
        new SocketClosedUnexpectedlyError(),
        new ConnectionTimeoutError(),
        Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    ])(
        'turns a reported cache transport failure into a single and batch miss: %s',
        async (failure) => {
            const { cache, client } = fixture()
            vi.spyOn(console, 'warn').mockImplementation(() => {})
            vi.spyOn(client, 'get').mockRejectedValueOnce(failure)
            vi.mocked(client.mGet).mockRejectedValueOnce(failure)
            expect(await cache.cacheGet('game')).toEqual({ cached: false, value: null })
            expect(await cache.cacheGetMulti(['one', 'two'])).toEqual([
                { cached: false, value: null },
                { cached: false, value: null }
            ])
        }
    )

    it.each([new TypeError('programming error'), new SimpleError('WRONGTYPE unexpected type')])(
        'does not hide non-transport failures: %s',
        async (failure) => {
            const { cache, client } = fixture()
            vi.spyOn(client, 'get').mockRejectedValueOnce(failure)
            await expect(cache.cacheGet('game')).rejects.toBe(failure)
        }
    )

    it('reads the database without fill permission when Redis reads and read acquisition fail', async () => {
        const { cache, client, exec } = fixture()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(client, 'get').mockRejectedValueOnce(new ClientOfflineError())
        vi.mocked(client.mGet).mockRejectedValueOnce(new ClientOfflineError())
        const producer = vi.fn(async () => 'from database')

        await expect(cache.cachingGet('game', producer)).resolves.toBe('from database')
        expect(producer).toHaveBeenCalledTimes(1)
        expect(exec).not.toHaveBeenCalled()
    })

    it('preserves batch result order while falling back without cache fill permission', async () => {
        const { cache, client, exec } = fixture()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.mocked(client.mGet).mockRejectedValue(new ClientOfflineError())
        const producer = vi.fn(async () => ['first', undefined])

        await expect(cache.cachingGetMulti(['one', 'two', 'one'], producer)).resolves.toEqual([
            'first',
            undefined,
            'first'
        ])
        expect(producer).toHaveBeenCalledWith(['one', 'two'])
        expect(exec).not.toHaveBeenCalled()
    })

    it('propagates a database read failure after cache fallback', async () => {
        const { cache, client, exec } = fixture()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(client, 'get').mockRejectedValueOnce(new ClientOfflineError())
        vi.mocked(client.mGet).mockRejectedValueOnce(new ClientOfflineError())
        const failure = new Error('database read failed')

        await expect(
            cache.cachingGet('game', async () => {
                throw failure
            })
        ).rejects.toBe(failure)
        expect(exec).not.toHaveBeenCalled()
    })
})
