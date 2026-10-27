import Fastify from 'fastify'
import auth from '@fastify/auth'
import { afterEach, expect, it, vi } from 'vitest'
import { manifestPublicationSignature } from '@tabletop/games-config'
import { LibraryService } from '../../../../libs/backend-services/src/games/libraryService.js'
import { RedisCacheService } from '../../../../libs/backend-services/src/cache/cacheService.js'
import { logicPublicationFixture } from '../../../../libs/backend-services/src/games/tests/logicPublicationFixture.js'
import invalidate from '../app/routes/api/admin/manifest/invalidate.js'
import { cloudManifestReader } from './cloudManifest.js'

const request = vi.hoisted(() => vi.fn())
vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        request = request
    }
}))

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
    request.mockReset()
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function fixture() {
    const f = await logicPublicationFixture()
    cleanups.push(f.close)
    await f.artifact('1.0.0')
    await f.artifact('1.1.0')
    await f.publish(f.manifest('1.0.0'))
    request.mockResolvedValue({ data: f.manifest('1.0.0') })
    const library = new LibraryService(RedisCacheService.prototype, {
        useCache: false,
        manifestPath: f.manifestPath,
        logicRoot: f.directory,
        readManifest: cloudManifestReader('gs://test-static/config/site-manifest.json')
    })
    await library.getTitlesMap()
    const server = Fastify()
    cleanups.push(() => server.close())
    server.decorate('libraryService', library)
    server.decorate('verifyActiveUser', async () => {})
    server.decorate('verifyRoleAdmin', async () => {})
    await server.register(auth)
    await server.register(invalidate)
    return { ...f, library, server }
}

it('activates the Cloud Storage publication despite a stale mounted manifest', async () => {
    const f = await fixture()
    const published = f.manifest('1.1.0')
    request.mockResolvedValue({ data: published })

    const response = await f.server.inject({ method: 'POST', url: '/invalidate' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
        activation: 'complete',
        publication: manifestPublicationSignature(published)
    })
    expect(f.library.getGeneration(f.titleId)?.definition.info.metadata.version).toBe('1.1.0')
    expect(request).toHaveBeenLastCalledWith({
        url: 'https://storage.googleapis.com/storage/v1/b/test-static/o/config%2Fsite-manifest.json?alt=media',
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 15_000
    })
})

it('does not report activation success or fall back to disk when Cloud Storage fails', async () => {
    const f = await fixture()
    request.mockRejectedValue(new Error('Cloud Storage unavailable'))

    const response = await f.server.inject({ method: 'POST', url: '/invalidate' })

    expect(response.statusCode).toBe(500)
    expect(response.json()).not.toHaveProperty('activation', 'complete')
    expect(f.library.getGeneration(f.titleId)?.definition.info.metadata.version).toBe('1.0.0')
})

it.each([undefined, 'https://example.com/manifest', 'gs://test-static/'])(
    'requires an explicit Cloud Storage object instead of silently using the mounted file: %s',
    (uri) => {
        expect(() => cloudManifestReader(uri)).toThrow('SITE_MANIFEST_GCS_URI')
    }
)
