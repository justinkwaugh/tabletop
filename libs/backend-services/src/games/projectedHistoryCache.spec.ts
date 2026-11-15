import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, type RedisClientType } from 'redis'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    PrivateHandHost,
    p1,
    p2,
    playPrivateHand
} from '@tabletop/common/test-fixtures/private-hand'
import { ProjectedHistoryCache } from './projectedHistoryCache.js'

const ids = (actions: readonly GameAction[]) => actions.map((action) => action.id)

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST)('projected history cache', () => {
    let client: RedisClientType
    let cache: ProjectedHistoryCache
    let gameId: string
    let key: { gameId: string; perspective: typeof p1; logicVersion: string }
    let redisKey: string

    beforeEach(async () => {
        gameId = `projected-history-test-${randomUUID()}`
        key = { gameId, perspective: p1, logicVersion: '1.0.0' }
        redisKey = ProjectedHistoryCache.keyFor(key)
        client = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        await client.connect()
        cache = new ProjectedHistoryCache(client)
    })

    afterEach(async () => {
        try {
            for await (const keys of client.scanIterator({ MATCH: `*${gameId}*`, COUNT: 100 })) {
                if (keys.length) await client.del(keys)
            }
        } finally {
            client.destroy()
        }
    })

    it('returns a saved projected history as the prefix of the same canonical history', async () => {
        const host = new PrivateHandHost()
        playPrivateHand(host, 'turn')
        const projected = host.history(p1).actions

        const empty = await cache.read(key, ids(host.actions))
        expect(empty.actions).toEqual([])
        await empty.save([...projected])

        const cached = await cache.read(key, ids(host.actions))
        expect(cached.actions).toEqual(projected)
    })

    it('keeps only the records before an undo and repairs the entry when saved', async () => {
        const host = new PrivateHandHost()
        playPrivateHand(host, 'first')
        await (await cache.read(key, ids(host.actions))).save(host.history(p1).actions)
        const undoneAt = 2
        const kept = host.history(p1).actions.slice(0, undoneAt)
        host.undo(host.actions[undoneAt].id)
        playPrivateHand(host, 'second')
        const projected = host.history(p1).actions

        const diverged = await cache.read(key, ids(host.actions))
        expect(diverged.actions).toEqual(kept)
        await diverged.save(projected.slice(undoneAt))

        expect((await cache.read(key, ids(host.actions))).actions).toEqual(projected)
    })

    it('appends records after a move to an existing entry but never starts one', async () => {
        const host = new PrivateHandHost()
        playPrivateHand(host, 'early', 2)
        const missing = { ...key, perspective: p2 }
        await (await cache.read(key, ids(host.actions))).save(host.history(p1).actions)
        const startIndex = host.actions.length
        playPrivateHand(host, 'late')

        await cache.append(key, host.history(p1).actions.slice(startIndex))
        await cache.append(missing, host.history(p2).actions.slice(startIndex))

        expect((await cache.read(key, ids(host.actions))).actions).toEqual(host.history(p1).actions)
        expect((await cache.read(missing, ids(host.actions))).actions).toEqual([])
    })

    it('stops before a move appended out of order and rewrites the entry when saved', async () => {
        const host = new PrivateHandHost()
        const [first] = playPrivateHand(host, 'first', 1)
        await (await cache.read(key, ids(host.actions))).save(host.history(p1).actions)
        const [second, third] = playPrivateHand(host, 'later', 2)
        const projected = host.history(p1).actions
        const recordsOf = (result: typeof first) =>
            projected.filter((record) => result.processedActions.some((a) => a.id === record.id))

        await cache.append(key, recordsOf(third))
        await cache.append(key, recordsOf(second))

        const misordered = await cache.read(key, ids(host.actions))
        expect(misordered.actions).toEqual(recordsOf(first))
        await misordered.save(projected.slice(misordered.actions.length))

        expect(await client.lLen(redisKey)).toBe(1)
        expect((await cache.read(key, ids(host.actions))).actions).toEqual(projected)
    })

    it('stores a continuing tail as one more piece and leaves a complete entry untouched', async () => {
        const host = new PrivateHandHost()
        playPrivateHand(host, 'early', 2)
        await (await cache.read(key, ids(host.actions))).save(host.history(p1).actions)
        const startIndex = host.actions.length
        playPrivateHand(host, 'late')

        const partial = await cache.read(key, ids(host.actions))
        await partial.save(host.history(p1).actions.slice(startIndex))
        expect(await client.lLen(redisKey)).toBe(2)

        const complete = await cache.read(key, ids(host.actions))
        await complete.save([])
        expect(await client.lLen(redisKey)).toBe(2)
        expect((await cache.read(key, ids(host.actions))).actions).toEqual(host.history(p1).actions)
    })

    it('merges an entry into one piece once it holds more than 32', async () => {
        const record = (index: number): GameAction => ({
            id: `action-${index}`,
            gameId,
            source: ActionSource.User,
            type: 'test',
            index
        })
        const records = Array.from({ length: 40 }, (_, index) => record(index))
        await (await cache.read(key, ids(records))).save(records.slice(0, 1))
        for (const action of records.slice(1)) await cache.append(key, [action])
        expect(await client.lLen(redisKey)).toBe(40)

        await (await cache.read(key, ids(records))).save([])

        expect(await client.lLen(redisKey)).toBe(1)
        expect((await cache.read(key, ids(records))).actions).toEqual(records)
    })

    it('stops at a piece it cannot decode and replaces it when saved', async () => {
        const host = new PrivateHandHost()
        playPrivateHand(host, 'early', 2)
        await (await cache.read(key, ids(host.actions))).save(host.history(p1).actions)
        const kept = host.history(p1).actions
        await client.rPush(redisKey, 'not a gzipped piece')
        playPrivateHand(host, 'late')

        const read = await cache.read(key, ids(host.actions))
        expect(read.actions).toEqual(kept)
        await read.save(host.history(p1).actions.slice(kept.length))

        expect(await client.lLen(redisKey)).toBe(1)
        expect((await cache.read(key, ids(host.actions))).actions).toEqual(host.history(p1).actions)
    })

    it('reads a miss and drops writes while Redis is unreachable', async () => {
        const host = new PrivateHandHost()
        playPrivateHand(host, 'turn')
        const offline: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const unreachable = new ProjectedHistoryCache(offline)

        const read = await unreachable.read(key, ids(host.actions))
        expect(read.actions).toEqual([])
        await expect(read.save(host.history(p1).actions)).resolves.toBeUndefined()
        await expect(unreachable.append(key, host.history(p1).actions)).resolves.toBeUndefined()
    })
})
