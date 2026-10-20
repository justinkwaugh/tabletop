import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyFile, mkdir, readFile, utimes } from 'node:fs/promises'
import path from 'node:path'
import { LibraryService } from './libraryService.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { logicPublicationFixture } from './tests/logicPublicationFixture.js'

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function fixture() {
    const fixture = await logicPublicationFixture()
    cleanups.push(fixture.close)
    await fixture.artifact('1.0.0')
    await fixture.artifact('1.1.0')
    await fixture.publish(fixture.manifest('1.0.0'))
    const options = {
        logicRoot: fixture.directory,
        manifestPath: fixture.manifestPath,
        useCache: false
    }
    return { ...fixture, options }
}

const version = (library: LibraryService, titleId: string) =>
    library.getGeneration(titleId)?.definition.info.metadata.version

describe('Collectible title generations', () => {
    it('pins in-flight work while new work sees the replacement, and releases retired references', async () => {
        const f = await fixture()
        const library = new LibraryService(RedisCacheService.prototype, f.options)
        await library.getTitlesMap()
        const scope = library.createScope()
        const original = library.runInScope(scope, () => library.getGeneration(f.titleId))
        await f.publish(f.manifest('1.1.0'))
        await library.refreshAndActivate()
        expect(version(library, f.titleId)).toBe('1.1.0')
        expect(library.runInScope(scope, () => library.getGeneration(f.titleId))).toBe(original)
        library.releaseScope(scope)
        expect(scope.generations.size).toBe(0)
        // Work that outlives its request sees the current generation and pins nothing.
        const late = library.runInScope(scope, () => library.getGeneration(f.titleId))
        expect(late?.definition.info.metadata.version).toBe('1.1.0')
        expect(scope.generations.size).toBe(0)
    })

    it('keeps serving the loaded titles until a queued activation completes', async () => {
        const f = await fixture()
        const gate = Promise.withResolvers<void>()
        const library = new LibraryService(RedisCacheService.prototype, {
            ...f.options,
            prepare: async (generation) => {
                if (generation.publication.logicVersion === '1.1.0') await gate.promise
            }
        })
        await library.getTitlesMap()
        await f.publish(f.manifest('1.1.0'))
        const manifest = await library.refreshManifest()
        expect(manifest.games[0].logicVersion).toBe('1.1.0')
        expect(version(library, f.titleId)).toBe('1.0.0')
        expect((await library.getServedManifest()).games[0].logicVersion).toBe('1.0.0')
        // Further refreshes neither block on nor repeat the pending activation.
        expect((await library.refreshManifest()).games[0].logicVersion).toBe('1.1.0')
        gate.resolve()
        await library.activation()
        expect(version(library, f.titleId)).toBe('1.1.0')
        expect((await library.getServedManifest()).games[0].logicVersion).toBe('1.1.0')
    })

    it('leaves the serving generation intact when preparation fails, and retries after a pause', async () => {
        const f = await fixture()
        let attempts = 0
        const library = new LibraryService(RedisCacheService.prototype, {
            ...f.options,
            prepare: async (generation) => {
                if (generation.publication.logicVersion !== '1.1.0') return
                attempts += 1
                throw new Error('Invalid validator')
            }
        })
        await library.getTitlesMap()
        const original = library.getGeneration(f.titleId)
        await f.publish(f.manifest('1.1.0'))
        await expect(library.refreshAndActivate()).rejects.toThrow('Invalid validator')
        expect(library.getGeneration(f.titleId)).toBe(original)
        expect((await library.getServedManifest()).games[0].logicVersion).toBe('1.0.0')
        await expect(library.refreshAndActivate()).rejects.toThrow('Invalid validator')
        expect(attempts).toBe(1)
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
        await expect(library.refreshAndActivate()).rejects.toThrow('Invalid validator')
        expect(attempts).toBe(2)
    })

    it('loads legacy ESM artifacts that have no factory', async () => {
        const f = await fixture()
        await f.artifact('0.9.0', 'esm')
        await f.publish(f.manifest('0.9.0'))
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const library = new LibraryService(RedisCacheService.prototype, f.options)
        expect((await library.getTitle(f.titleId))?.info.metadata.version).toBe('0.9.0')
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('no collectible factory'))
    })

    it('prefers a workspace bundle that is as fresh as the compiled sources, in local runs', async () => {
        const f = await fixture()
        const workspace = path.join(f.directory, 'synthetic')
        const bundle = path.join(workspace, 'bundle', 'index.cjs')
        const compiled = path.join(workspace, 'esm', 'index.js')
        await mkdir(path.dirname(bundle), { recursive: true })
        await mkdir(path.dirname(compiled), { recursive: true })
        await copyFile(path.join(await f.artifact('2.0.0'), 'index.cjs'), bundle)
        await copyFile(path.join(await f.artifact('2.0.1', 'esm'), 'index.js'), compiled)
        const local = { ...f.options, fallbackManifest: async () => f.manifest('2.0.0') }
        await f.publish(f.manifest('2.0.0'))
        const stamp = (file: string, seconds: number) =>
            utimes(file, new Date(seconds * 1000), new Date(seconds * 1000))
        await stamp(compiled, 1_000)
        await stamp(bundle, 2_000)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const fromBundle = new LibraryService(RedisCacheService.prototype, local)
        expect((await fromBundle.getTitle(f.titleId))?.info.metadata.version).toBe('2.0.0')
        expect(warn).not.toHaveBeenCalled()
        await stamp(compiled, 3_000)
        await f.publish(f.manifest('2.0.1'))
        const fromSources = new LibraryService(RedisCacheService.prototype, local)
        expect((await fromSources.getTitle(f.titleId))?.info.metadata.version).toBe('2.0.1')
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('no collectible factory'))
        expect(await readFile(bundle, 'utf8')).toContain('2.0.0')
    })

    it('does not reconstruct unchanged title code for UI-only publications', async () => {
        const f = await fixture()
        const library = new LibraryService(RedisCacheService.prototype, f.options)
        const first = await library.getTitle(f.titleId)
        const next = f.manifest('1.0.0')
        next.games[0].uiVersion = '1.1.0'
        await f.publish(next)
        await library.refreshAndActivate()
        expect(await library.getTitle(f.titleId)).toBe(first)
        expect((await library.getServedManifest()).games[0].uiVersion).toBe('1.1.0')
    })
})
