import assert from 'node:assert/strict'
import test from 'node:test'
import { manifestPublicationSignature } from '@tabletop/games-config'
import { invalidateBackendManifestCache } from '../esm/lib/backend.js'

const config = {
    backendAdmin: {
        url: 'https://backend.example/api/v1/admin/manifest/invalidate',
        cookie: 'test'
    }
}

test('activation must confirm the publication that was uploaded', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
        Response.json({ activation: 'complete', publication: 'previous' })
    )
    await assert.rejects(
        invalidateBackendManifestCache(config, { expectedPublication: 'published' }),
        /different publication/
    )
})

test('activation confirms a matching publication', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
        Response.json({ activation: 'complete', publication: 'published' })
    )
    assert.equal(
        await invalidateBackendManifestCache(config, { expectedPublication: 'published' }),
        'activated'
    )
})

test('an older backend cannot silently acknowledge an expected publication', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ activation: 'complete' }))
    await assert.rejects(
        invalidateBackendManifestCache(config, { expectedPublication: 'published' }),
        /release the backend first/
    )
    assert.equal(await invalidateBackendManifestCache(config), 'activated')
})

test('publication confirmation distinguishes all served versions but ignores history and ordering', () => {
    const manifest = {
        frontend: { version: '1.0.0' },
        games: ['alpha', 'beta'].map((gameId) => ({
            gameId,
            packageId: gameId,
            logicVersion: '1.0.0',
            uiVersion: '1.0.0'
        }))
    }
    const signature = manifestPublicationSignature(manifest)
    assert.equal(
        manifestPublicationSignature({
            frontend: { ...manifest.frontend, history: [{ version: '0.9.0' }] },
            games: [...manifest.games].reverse().map((game) => ({
                ...game,
                history: [{ logicVersion: '0.9.0', uiVersion: '0.9.0' }]
            }))
        }),
        signature
    )
    assert.notEqual(
        manifestPublicationSignature({ ...manifest, frontend: { version: '2.0.0' } }),
        signature
    )
    for (const field of ['gameId', 'packageId', 'logicVersion', 'uiVersion']) {
        assert.notEqual(
            manifestPublicationSignature({
                ...manifest,
                games: [{ ...manifest.games[0], [field]: 'changed' }, manifest.games[1]]
            }),
            signature
        )
    }
})
