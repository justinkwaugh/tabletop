import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { setImmediate } from 'node:timers/promises'
import path from 'node:path'
import { createClient, type RedisClientType } from 'redis'
import { SiteManifest } from '@tabletop/games-config'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { LibraryService } from './libraryService.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST)('manifest caching against Redis', () => {
    let live: ReturnType<typeof cacheFixture>
    let directory: string
    let manifestPath: string
    let cacheKey: string
    const before: SiteManifest = {
        ...SiteManifest,
        frontend: { ...SiteManifest.frontend, version: '1.0.0' },
        games: []
    }
    const after: SiteManifest = {
        ...before,
        frontend: { ...before.frontend, version: '2.0.0' }
    }

    beforeEach(async () => {
        directory = await mkdtemp(path.join(tmpdir(), 'manifest-cache-test-'))
        manifestPath = path.join(directory, 'manifest.json')
        cacheKey = `manifest-cache-test-${randomUUID()}`
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        await client.connect()
        live = cacheFixture(client)
        await writeFile(manifestPath, JSON.stringify(before))
    })

    afterEach(async () => {
        vi.restoreAllMocks()
        try {
            await live.client.del(cacheKey)
            await rm(directory, { recursive: true, force: true })
        } finally {
            live.cache.destroy()
            live.client.destroy()
        }
    })

    async function expectCached(manifest: SiteManifest) {
        await vi.waitFor(async () => {
            expect(await live.cache.get<SiteManifest>(cacheKey)).toEqual({
                cached: true,
                value: manifest
            })
        })
    }

    it.each([false, true])(
        'revokes a delayed fill when invalidated (new manifest cached: %s)',
        async (cacheNewManifest) => {
            const first = new LibraryService(live.cache, { manifestPath, cacheKey })
            const second = new LibraryService(live.cache, { manifestPath, cacheKey })
            const pending: Promise<void>[] = []
            const set = live.cache.set.bind(live.cache)
            const cacheSet = live.cache.cacheSet.bind(live.cache)
            const publishBeforeFill = (fill: () => Promise<void>) => {
                const task = (async () => {
                    await writeFile(manifestPath, JSON.stringify(after))
                    await second.invalidateManifestCache()
                    if (cacheNewManifest) {
                        await second.refreshManifest()
                        await expectCached(after)
                    }
                    await fill()
                })()
                pending.push(task)
                return task
            }
            vi.spyOn(live.cache, 'set').mockImplementationOnce((...args) =>
                publishBeforeFill(() => set(...args))
            )
            vi.spyOn(live.cache, 'cacheSet').mockImplementationOnce((...args) =>
                publishBeforeFill(() => cacheSet(...args))
            )

            expect(await first.refreshManifest()).toEqual(before)
            expect(pending).toHaveLength(1)
            await Promise.all(pending)
            if (cacheNewManifest) {
                await expectCached(after)
            } else {
                expect((await live.cache.cacheGet(cacheKey)).cached).toBe(false)
                expect(await second.refreshManifest()).toEqual(after)
                await expectCached(after)
            }
        }
    )

    it('serves a cached manifest without requiring its source file', async () => {
        const first = new LibraryService(live.cache, { manifestPath, cacheKey })
        expect(await first.refreshManifest()).toEqual(before)
        await expectCached(before)
        await rm(manifestPath)
        const second = new LibraryService(live.cache, { manifestPath, cacheKey })
        expect(await second.refreshManifest()).toEqual(before)
    })

    it('orders overlapping refreshes across invalidation without reusing the earlier read', async () => {
        const service = new LibraryService(live.cache, { manifestPath, cacheKey })
        await service.refreshManifest()
        await expectCached(before)
        const changes: string[] = []
        service.onManifestMismatch(({ next }) => changes.push(next.frontend.version))
        const readStarted = Promise.withResolvers<void>()
        const releaseRead = Promise.withResolvers<void>()
        const cacheGet = live.cache.cacheGet.bind(live.cache)
        const reads = vi.spyOn(live.cache, 'cacheGet').mockImplementationOnce(async (key) => {
            const result = await cacheGet(key)
            readStarted.resolve()
            await releaseRead.promise
            return result
        })
        const refreshes = [service.refreshManifest()]
        try {
            await readStarted.promise
            await writeFile(manifestPath, JSON.stringify(after))
            await service.invalidateManifestCache()
            refreshes.push(service.refreshManifest())
            await setImmediate()
            expect.soft(reads).toHaveBeenCalledTimes(1)
        } finally {
            releaseRead.resolve()
            expect(await Promise.all(refreshes)).toEqual([before, after])
        }

        await expectCached(after)
        expect((await live.cache.get<SiteManifest>(cacheKey)).value).toEqual(after)
        expect.soft(changes).toEqual(['2.0.0'])
        expect((await service.getManifest()).frontend.version).toBe('2.0.0')
    })

    it('continues queued refreshes after an earlier refresh fails', async () => {
        const service = new LibraryService(live.cache, { manifestPath, cacheKey })
        const error = new Error('Failed manifest cache read')
        vi.spyOn(live.cache, 'cacheGet').mockRejectedValueOnce(error)
        const results = await Promise.allSettled([
            service.refreshManifest(),
            service.refreshManifest()
        ])
        expect(results).toEqual([
            { status: 'rejected', reason: error },
            { status: 'fulfilled', value: before }
        ])
        expect(await service.getManifest()).toEqual(before)
        await expectCached(before)
    })

    it('keeps the packaged fallback out of the shared cache', async () => {
        await rm(manifestPath)
        const service = new LibraryService(live.cache, {
            manifestPath,
            cacheKey,
            allowFallback: true
        })
        expect(await service.refreshManifest()).toEqual(SiteManifest)
        expect((await live.cache.cacheGet(cacheKey)).cached).toBe(false)
        await writeFile(manifestPath, JSON.stringify(after))
        expect(await service.refreshManifest()).toEqual(after)
    })

    it('keeps an earlier local snapshot out of the shared cache after a failed read', async () => {
        const service = new LibraryService(live.cache, { manifestPath, cacheKey })
        await service.refreshManifest()
        await expectCached(before)
        await service.invalidateManifestCache()
        await writeFile(manifestPath, '{invalid json')
        expect(await service.refreshManifest()).toEqual(before)
        expect((await live.cache.cacheGet(cacheKey)).cached).toBe(false)
        await writeFile(manifestPath, JSON.stringify(after))
        expect(await service.refreshManifest()).toEqual(after)
    })

    it('does not cache absence when the file is unavailable and no fallback exists', async () => {
        await rm(manifestPath)
        const service = new LibraryService(live.cache, { manifestPath, cacheKey })
        await expect(service.refreshManifest()).rejects.toThrow('Manifest unavailable')
        expect((await live.cache.cacheGet(cacheKey)).cached).toBe(false)
        await writeFile(manifestPath, JSON.stringify(after))
        expect(await service.refreshManifest()).toEqual(after)
    })

    it('preserves uncached file loading', async () => {
        const read = vi.spyOn(live.cache, 'cachingGet')
        const service = new LibraryService(live.cache, { manifestPath, cacheKey, useCache: false })
        expect(await service.refreshManifest()).toEqual(before)
        await writeFile(manifestPath, JSON.stringify(after))
        expect(await service.refreshManifest()).toEqual(after)
        expect(read).not.toHaveBeenCalled()
        expect(await live.client.get(cacheKey)).toBeNull()
    })

    it('propagates cache protocol errors even when a packaged fallback is allowed', async () => {
        await live.client.hSet(cacheKey, 'unexpected', 'hash')
        const service = new LibraryService(live.cache, {
            manifestPath,
            cacheKey,
            allowFallback: true
        })
        await expect(service.refreshManifest()).rejects.toThrow('WRONGTYPE')
    })
})
