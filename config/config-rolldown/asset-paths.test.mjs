import assert from 'node:assert/strict'
import test from 'node:test'
import { gameUiPublicAssetsPath } from './asset-paths.js'

test('a local build keeps asset paths on the site', () => {
    assert.equal(
        gameUiPublicAssetsPath({ gameId: 'a', uiVersion: '1.0.0' }),
        '/games/a/ui/1.0.0/assets/'
    )
})

test('a release build addresses assets in the public bucket', () => {
    assert.equal(
        gameUiPublicAssetsPath({
            gameId: 'a',
            uiVersion: '1.0.0',
            assetBaseUrl: 'https://storage.example/bucket'
        }),
        'https://storage.example/bucket/games/a/ui/1.0.0/assets/'
    )
})
