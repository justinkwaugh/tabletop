import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, TimeoutError, type RedisClientType } from 'redis'
import { assertExists, GameResult, GameStatus, PlayerStatus, type Game } from '@tabletop/common'
import {
    RECENTLY_FINISHED_LIMIT,
    TitleActivityCache,
    TitleActivityUnavailableError,
    type TitleActivitySource
} from './titleActivityCache.js'
import { GameCacheKeys } from '../persistence/firestore/gameCacheKeys.js'
import { RedisProxy } from '../cache/tests/redisProxy.js'
import { RedisService } from '../redis/redisService.js'

const MINUTE = 60_000

class FakeSource implements TitleActivitySource {
    games: Game[] = []
    queries = 0
    candidatesRead = 0
    hold: Promise<void> | undefined

    async findInProgressCandidates(titleId: string): Promise<Game[]> {
        return this.read(
            this.games.filter(
                (game) =>
                    game.typeId === titleId && game.isPublic && game.status === GameStatus.Started
            )
        )
    }

    async findFinishedCandidates(
        titleId: string,
        after: Game | undefined,
        limit: number
    ): Promise<Game[]> {
        const finished = this.games
            .filter(
                (game) =>
                    game.typeId === titleId && game.isPublic && game.status === GameStatus.Finished
            )
            .sort(
                (a, b) =>
                    (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0) ||
                    (a.id < b.id ? 1 : -1)
            )
        const start = after ? finished.findIndex((game) => game.id === after.id) + 1 : 0
        return this.read(finished.slice(start, start + limit))
    }

    private async read(games: Game[]): Promise<Game[]> {
        this.queries++
        await this.hold
        this.candidatesRead += games.length
        return structuredClone(games)
    }
}

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST)('title activity cache', () => {
    let client: RedisClientType
    let cache: TitleActivityCache
    let source: FakeSource
    let titleId: string
    let key: string
    const base = Date.parse('2026-10-01T00:00:00Z')

    function game(id: string, fields: Partial<Game> = {}): Game {
        return {
            id: `${titleId}-${id}`,
            typeId: titleId,
            name: id,
            status: GameStatus.Started,
            isPublic: true,
            deleted: false,
            ownerId: 'owner',
            hotseat: false,
            config: {},
            players: [
                {
                    id: 'p1',
                    userId: 'owner',
                    name: 'Owner',
                    isHuman: true,
                    status: PlayerStatus.Joined
                }
            ],
            createdAt: new Date(base),
            startedAt: new Date(base),
            updatedAt: new Date(base),
            winningPlayerIds: [],
            ...fields
        }
    }

    function finished(id: string, minutes: number, fields: Partial<Game> = {}): Game {
        return game(id, {
            status: GameStatus.Finished,
            result: GameResult.Win,
            winningPlayerIds: ['p1'],
            finishedAt: new Date(base + minutes * MINUTE),
            updatedAt: new Date(base + minutes * MINUTE),
            ...fields
        })
    }

    function later(previous: Game, minutes: number, fields: Partial<Game>): Game {
        return {
            ...structuredClone(previous),
            updatedAt: new Date((previous.updatedAt?.getTime() ?? base) + minutes * MINUTE),
            ...fields
        }
    }

    async function names(reader = cache) {
        const activity = await reader.read(titleId, source)
        return {
            inProgress: activity.inProgress.map((game) => game.name),
            recentlyFinished: activity.recentlyFinished.map((game) => game.name)
        }
    }

    beforeEach(async () => {
        titleId = `title-activity-test-${randomUUID()}`
        key = GameCacheKeys.titleActivity(titleId)
        client = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        await client.connect()
        cache = new TitleActivityCache(client)
        source = new FakeSource()
    })

    afterEach(async () => {
        vi.restoreAllMocks()
        try {
            await client.del(key)
        } finally {
            client.destroy()
        }
    })

    it('lists publicly listed games once read, then serves warm reads without the source', async () => {
        source.games = [
            game('quiet', { lastActionAt: new Date(base + MINUTE) }),
            game('busy', { lastActionAt: new Date(base + 5 * MINUTE) }),
            game('unlisted', { unlisted: true }),
            game('invite-only', { isPublic: false }),
            game('waiting', { status: GameStatus.WaitingForPlayers }),
            finished('older', 1),
            finished('newer', 2),
            finished('unlisted-finished', 3, { unlisted: true })
        ]

        expect(await names()).toEqual({
            inProgress: ['busy', 'quiet'],
            recentlyFinished: ['newer', 'older']
        })
        expect(source.queries).toBe(2)

        const activity = await cache.read(titleId, source)
        expect(source.queries).toBe(2)
        expect(activity.inProgress[0].lastActionAt).toEqual(new Date(base + 5 * MINUTE))
        expect(activity.inProgress[0].state).toBeUndefined()
    })

    it('caches an empty title instead of reading it again', async () => {
        expect(await names()).toEqual({ inProgress: [], recentlyFinished: [] })
        expect(await names()).toEqual({ inProgress: [], recentlyFinished: [] })
        expect(source.queries).toBe(2)
    })

    it('pages past unlisted finished games until fifty are listed', async () => {
        source.games = Array.from({ length: 100 }, (_, index) =>
            finished(`f${index}`, index, index % 5 === 0 ? { unlisted: true } : {})
        )

        const { recentlyFinished } = await cache.read(titleId, source)

        expect(recentlyFinished).toHaveLength(RECENTLY_FINISHED_LIMIT)
        expect(recentlyFinished[0].name).toBe('f99')
        expect(recentlyFinished.every((game) => !game.unlisted)).toBe(true)
        // Pages of 50, 10 and 10 finished candidates, plus the empty in-progress query.
        expect(source.queries).toBe(4)
        expect(source.candidatesRead).toBe(70)
    })

    it('follows a game through start, play, finish, reopening and deletion', async () => {
        await names()
        const waiting = game('g', { status: GameStatus.WaitingForPlayers })
        const started = later(waiting, 1, { status: GameStatus.Started })
        await cache.applyChange(waiting, started)
        expect(await names()).toEqual({ inProgress: ['g'], recentlyFinished: [] })

        const moved = later(started, 1, { name: 'g moved', lastActionAt: new Date(base) })
        await cache.applyChange(started, moved)
        expect(await names()).toEqual({ inProgress: ['g moved'], recentlyFinished: [] })

        const done = later(moved, 1, {
            status: GameStatus.Finished,
            result: GameResult.Win,
            finishedAt: new Date(base + 3 * MINUTE)
        })
        await cache.applyChange(moved, done)
        expect(await names()).toEqual({ inProgress: [], recentlyFinished: ['g moved'] })

        const scored = { ...done, finalScores: { p1: 12 } }
        await cache.applyChange(done, scored)
        expect((await cache.read(titleId, source)).recentlyFinished[0].finalScores).toEqual({
            p1: 12
        })

        const reopened = later(scored, 1, { status: GameStatus.Started, finishedAt: undefined })
        await cache.applyChange(scored, reopened)
        expect(await names()).toEqual({ inProgress: ['g moved'], recentlyFinished: [] })

        await cache.applyChange(reopened, undefined)
        expect(await names()).toEqual({ inProgress: [], recentlyFinished: [] })
        expect(source.queries).toBe(2)
    })

    it('drops a game whose visibility leaves public discovery', async () => {
        const listed = game('g')
        source.games = [listed]
        expect((await names()).inProgress).toEqual(['g'])

        await cache.applyChange(listed, later(listed, 1, { unlisted: true }))
        expect((await names()).inProgress).toEqual([])
        const relisted = later(listed, 2, {})
        await cache.applyChange(listed, relisted)
        expect((await names()).inProgress).toEqual(['g'])
        await cache.applyChange(relisted, later(relisted, 1, { isPublic: false }))
        expect((await names()).inProgress).toEqual([])
    })

    it('keeps the latest fifty finished games and leaves forty-nine after a removal', async () => {
        source.games = Array.from({ length: 60 }, (_, index) => finished(`f${index}`, index))
        await names()

        const newest = later(game('new'), 0, {
            status: GameStatus.Finished,
            finishedAt: new Date(base + 100 * MINUTE)
        })
        await cache.applyChange(game('new'), newest)
        const ancient = later(game('ancient'), 0, {
            status: GameStatus.Finished,
            finishedAt: new Date(base - 100 * MINUTE)
        })
        await cache.applyChange(game('ancient'), ancient)

        let finishedNames = (await names()).recentlyFinished
        expect(finishedNames).toHaveLength(RECENTLY_FINISHED_LIMIT)
        expect(finishedNames[0]).toBe('new')
        expect(finishedNames.at(-1)).toBe('f11')
        expect(finishedNames).not.toContain('ancient')

        await cache.applyChange(newest, undefined)
        finishedNames = (await names()).recentlyFinished
        expect(finishedNames).toHaveLength(RECENTLY_FINISHED_LIMIT - 1)
        expect(finishedNames[0]).toBe('f59')
        expect(source.queries).toBe(2)
        expect(
            Object.keys(await client.hGetAll(key)).filter((field) => field.startsWith('f:'))
        ).toHaveLength(RECENTLY_FINISHED_LIMIT - 1)
    })

    it('orders finished games completed at the same moment by id', async () => {
        source.games = [finished('a', 1), finished('c', 1), finished('b', 1)]
        expect((await names()).recentlyFinished).toEqual(['c', 'b', 'a'])
    })

    it('ignores a change older than the one already applied to that game', async () => {
        await names()
        const started = game('g')
        const done = later(started, 2, {
            status: GameStatus.Finished,
            finishedAt: new Date(base + MINUTE)
        })
        await cache.applyChange(started, done)
        await cache.applyChange(started, later(started, 1, { name: 'stale' }))
        expect(await names()).toEqual({ inProgress: [], recentlyFinished: ['g'] })
    })

    it('does not create a list from a change to an uncached title', async () => {
        const started = game('g')
        await cache.applyChange(undefined, started)
        expect(await client.exists(key)).toBe(0)

        source.games = [game('other')]
        expect((await names()).inProgress).toEqual(['other'])
    })

    it('never writes for games that are not publicly listed before or after', async () => {
        const evalSpy = vi.spyOn(client, 'eval')
        const hidden = game('g', { isPublic: false })
        await cache.applyChange(hidden, later(hidden, 1, {}))
        await cache.applyChange(undefined, game('w', { status: GameStatus.WaitingForPlayers }))
        expect(evalSpy).not.toHaveBeenCalled()
    })

    it('applies concurrent changes to different games without losing any', async () => {
        await names()
        const games = Array.from({ length: 25 }, (_, index) => game(`g${index}`))
        await Promise.all(games.map((started) => cache.applyChange(undefined, started)))
        expect((await names()).inProgress).toHaveLength(25)

        await Promise.all(
            games.map((started, index) =>
                cache.applyChange(
                    started,
                    index % 2
                        ? later(started, 1, {
                              status: GameStatus.Finished,
                              finishedAt: new Date(base + index * MINUTE)
                          })
                        : later(started, 1, { name: `${started.name} moved` })
                )
            )
        )
        const after = await names()
        expect(after.inProgress).toHaveLength(13)
        expect(after.inProgress.every((name) => name.endsWith('moved'))).toBe(true)
        expect(after.recentlyFinished).toHaveLength(12)
    })

    it('shares one rebuild among concurrent cold reads across instances', async () => {
        source.games = [game('g'), finished('f', 1)]
        let release = () => {}
        source.hold = new Promise((resolve) => (release = resolve))
        const otherInstance = new TitleActivityCache(client)

        const reads = [
            cache.read(titleId, source),
            cache.read(titleId, source),
            otherInstance.read(titleId, source),
            otherInstance.read(titleId, source)
        ]
        await vi.waitFor(() => expect(source.queries).toBe(2))
        release()

        for (const activity of await Promise.all(reads)) {
            expect(activity.inProgress.map((game) => game.name)).toEqual(['g'])
            expect(activity.recentlyFinished.map((game) => game.name)).toEqual(['f'])
        }
        expect(source.queries).toBe(2)
    })

    it('keeps changes committed while a rebuild reads the source', async () => {
        const read = game('g')
        source.games = [read, game('h')]
        let release = () => {}
        source.hold = new Promise((resolve) => (release = resolve))
        const rebuilt = cache.read(titleId, source)
        await vi.waitFor(() => expect(source.queries).toBe(2))

        await cache.applyChange(
            read,
            later(read, 1, { status: GameStatus.Finished, finishedAt: new Date(base) })
        )
        await cache.applyChange(undefined, game('started-meanwhile'))
        release()

        const activity = await rebuilt
        expect(activity.inProgress.map((game) => game.name).sort()).toEqual([
            'h',
            'started-meanwhile'
        ])
        expect(activity.recentlyFinished.map((game) => game.name)).toEqual(['g'])
    })

    it('rebuilds after the cached list is lost or a rebuild fails', async () => {
        source.games = [game('g')]
        vi.spyOn(source, 'findInProgressCandidates').mockRejectedValueOnce(new Error('offline'))
        await expect(cache.read(titleId, source)).rejects.toThrow('offline')
        expect(await client.exists(key)).toBe(0)

        expect((await names()).inProgress).toEqual(['g'])
        await client.del(key)
        source.games = [game('g'), game('h')]
        expect((await names()).inProgress).toEqual(['g', 'h'])
    })

    it('expires a day after the rebuild without extending on changes', async () => {
        await names()
        const ttl = await client.ttl(key)
        expect(ttl).toBeGreaterThan(24 * 60 * 60 - 10)
        expect(ttl).toBeLessThanOrEqual(24 * 60 * 60)

        await client.expire(key, 100)
        await cache.applyChange(undefined, game('g'))
        expect(await client.ttl(key)).toBeLessThanOrEqual(100)
    })

    it('reports unavailable without reading the source when Redis is down', async () => {
        const offline: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const unavailable = new TitleActivityCache(offline)
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(unavailable.read(titleId, source)).rejects.toBeInstanceOf(
            TitleActivityUnavailableError
        )
        await expect(unavailable.applyChange(undefined, game('g'))).resolves.toBeUndefined()
        expect(source.queries).toBe(0)
    })

    describe('over a production client whose connection fails', () => {
        const timeoutMs = 300
        let proxy: RedisProxy
        let flaky: RedisClientType

        async function unavailableCause(reading: Promise<unknown>): Promise<unknown> {
            const error: unknown = await reading.then(
                () => undefined,
                (rejection: unknown) => rejection
            )
            expect(error).toBeInstanceOf(TitleActivityUnavailableError)
            return error instanceof Error ? error.cause : undefined
        }

        beforeEach(async () => {
            assertExists(process.env.CACHE_TEST_REDIS_HOST)
            proxy = new RedisProxy(process.env.CACHE_TEST_REDIS_HOST)
            await proxy.open()
            vi.stubEnv('REDIS_HOST', '127.0.0.1')
            vi.stubEnv('REDIS_PORT', String(proxy.port))
            flaky = await RedisService.createClient({ getSecret: async () => '' })
            flaky.on('error', () => {})
            await flaky.connect()
            vi.spyOn(console, 'warn').mockImplementation(() => {})
            vi.spyOn(console, 'error').mockImplementation(() => {})
        })

        afterEach(async () => {
            vi.unstubAllEnvs()
            if (flaky.isOpen) flaky.destroy()
            await proxy.close()
        })

        it('reports unavailable at once while reconnecting, drops changes, and serves again after', async () => {
            const reader = new TitleActivityCache(flaky, { commandTimeoutMs: 10_000 })
            source.games = [game('g')]
            expect((await names(reader)).inProgress).toEqual(['g'])

            await proxy.cut()
            await vi.waitFor(() => expect(flaky.isReady).toBe(false))
            const started = Date.now()
            await expect(reader.read(titleId, source)).rejects.toBeInstanceOf(
                TitleActivityUnavailableError
            )
            await reader.applyChange(undefined, game('while-offline'))
            expect(Date.now() - started).toBeLessThan(1000)
            expect(source.queries).toBe(2)

            await proxy.open()
            await vi.waitFor(() => expect(flaky.isReady).toBe(true), { timeout: 10_000 })
            expect((await names(reader)).inProgress).toEqual(['g'])
            await reader.applyChange(undefined, game('after-recovery'))
            expect((await names(reader)).inProgress).toEqual(['after-recovery', 'g'])
            expect(source.queries).toBe(2)
        }, 20_000)

        it('drops a command a disconnect queued after the readiness check', async () => {
            const reader = new TitleActivityCache(flaky, { commandTimeoutMs: timeoutMs })
            await names(reader)
            await proxy.cut()
            await vi.waitFor(() => expect(flaky.isReady).toBe(false))
            const readinessPassed = vi.spyOn(flaky, 'isReady', 'get').mockReturnValue(true)

            expect(await unavailableCause(reader.read(titleId, source))).toBeInstanceOf(
                TimeoutError
            )
            await reader.applyChange(undefined, game('queued'))

            readinessPassed.mockRestore()
            await proxy.open()
            await vi.waitFor(() => expect(flaky.isReady).toBe(true), { timeout: 10_000 })
            expect((await names(reader)).inProgress).toEqual([])
        }, 20_000)

        it('bounds a command Redis never answers, then recovers', async () => {
            const reader = new TitleActivityCache(flaky, { commandTimeoutMs: timeoutMs })
            source.games = [game('g')]
            await names(reader)

            proxy.stall()
            const started = Date.now()
            expect(await unavailableCause(reader.read(titleId, source))).toBeInstanceOf(
                TimeoutError
            )
            await reader.applyChange(undefined, game('while-stalled'))
            expect(Date.now() - started).toBeLessThan(4 * timeoutMs)
            expect(flaky.isReady).toBe(true)

            proxy.resume()
            expect((await names(reader)).inProgress).toEqual(['g', 'while-stalled'])
            expect(source.queries).toBe(2)
        })

        it('reports a stalled rebuild without waiting for its cleanup', async () => {
            const reader = new TitleActivityCache(flaky, { commandTimeoutMs: timeoutMs })
            source.games = [game('g')]
            let release = () => {}
            source.hold = new Promise((resolve) => (release = resolve))
            const rebuilding = unavailableCause(reader.read(titleId, source))
            await vi.waitFor(() => expect(source.queries).toBe(2))

            proxy.stall()
            const started = Date.now()
            release()
            expect(await rebuilding).toBeInstanceOf(TimeoutError)
            expect(Date.now() - started).toBeLessThan(1.5 * timeoutMs)

            proxy.resume()
            expect((await names(reader)).inProgress).toEqual(['g'])
            expect(source.queries).toBe(2)
        })
    })
})
