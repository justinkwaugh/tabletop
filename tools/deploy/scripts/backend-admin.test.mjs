import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import {
    describeIgnoredBackendAdminSettings,
    invalidateBackendManifestCache,
    resolveBackendAdminCredentials
} from '../esm/lib/backend.js'
import { mergeEnvConfig } from '../esm/lib/config.js'
import { assertGamePublishable } from '../esm/lib/gamePublish.js'
import { assertDeployConfig } from '../esm/lib/publishCore.js'

const SESSION_COOKIE = '__session=deploy-session'
const PASSWORD = 'correct horse battery staple'
const LEGACY_TOKEN = 'legacy-challenge-token-value'

// A backend without the challenge-token login route: username/password login issues the session
// cookie and manifest invalidation accepts only that cookie.
async function withBackend(invalidateResponse, run) {
    const requests = []
    const server = createServer((request, response) => {
        let body = ''
        request.on('data', (chunk) => (body += chunk))
        request.on('end', () => {
            requests.push({
                method: request.method,
                path: request.url,
                body,
                headers: request.headers
            })
            if (request.method === 'POST' && request.url === '/api/v1/auth/login') {
                const { username, password } = JSON.parse(body)
                if (username === 'admin' && password === PASSWORD) {
                    response.writeHead(200, {
                        'content-type': 'application/json',
                        'set-cookie': `${SESSION_COOKIE}; Path=/; HttpOnly`
                    })
                    response.end(JSON.stringify({ status: 'ok', payload: {} }))
                } else {
                    response.writeHead(401, { 'content-type': 'application/json' })
                    response.end(
                        JSON.stringify({ status: 'error', error: { name: 'Unauthorized' } })
                    )
                }
                return
            }
            if (request.method === 'POST' && request.url === '/api/v1/admin/manifest/invalidate') {
                if (request.headers.cookie !== SESSION_COOKIE) {
                    response.writeHead(401, { 'content-type': 'application/json' })
                    response.end(
                        JSON.stringify({ status: 'error', error: { name: 'Unauthorized' } })
                    )
                    return
                }
                response.writeHead(invalidateResponse.status, {
                    'content-type': 'application/json'
                })
                response.end(JSON.stringify(invalidateResponse.body))
                return
            }
            response.writeHead(404, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ status: 'error', error: { name: 'NotFound' } }))
        })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    try {
        return await run({
            origin,
            requests,
            config: (backendAdmin) => ({
                gcsBucket: 'bucket',
                backendManifestUrl: `${origin}/api/v1/manifest`,
                backendAdmin
            })
        })
    } finally {
        await new Promise((resolve) => server.close(resolve))
    }
}

const activated = {
    status: 200,
    body: { status: 'ok', replacement: 'none', activation: 'complete' }
}

test('username and password sign in once and invalidate with the issued session cookie', async () => {
    await withBackend(activated, async ({ requests, config }) => {
        const result = await invalidateBackendManifestCache(
            config({ username: 'admin', password: PASSWORD })
        )
        assert.equal(result, 'activated')
        assert.deepEqual(
            requests.map((request) => request.path),
            ['/api/v1/auth/login', '/api/v1/admin/manifest/invalidate']
        )
        assert.equal(requests[1].headers.cookie, SESSION_COOKIE)
    })
})

test('a configured cookie is sent as it is without signing in', async () => {
    await withBackend(
        { status: 200, body: { status: 'ok', replacement: 'superseded' } },
        async ({ requests, config }) => {
            const result = await invalidateBackendManifestCache(config({ cookie: SESSION_COOKIE }))
            assert.equal(result, 'superseded')
            assert.deepEqual(
                requests.map((request) => request.path),
                ['/api/v1/admin/manifest/invalidate']
            )
        }
    )
})

test('a token-only config is refused before any request, with migration guidance and no value', async () => {
    const config = mergeEnvConfig({
        gcsBucket: 'bucket',
        backendManifestUrl: 'http://127.0.0.1:9/api/v1/manifest',
        backendAdmin: { unsupportedSettings: ['backendAdmin.token'] }
    })
    await withBackend(activated, async ({ requests, config: withOrigin }) => {
        for (const candidate of [config, withOrigin(config.backendAdmin)]) {
            await assert.rejects(invalidateBackendManifestCache(candidate), (error) => {
                assert.match(error.message, /backendAdmin\.token/)
                assert.match(error.message, /no longer/)
                assert.match(error.message, /TABLETOP_BACKEND_ADMIN_USER/)
                assert.doesNotMatch(error.message, new RegExp(LEGACY_TOKEN))
                return true
            })
            assert.throws(() => assertDeployConfig(candidate), /backendAdmin\.token/)
            await assert.rejects(
                assertGamePublishable(
                    {
                        repoRoot: '/nonexistent/checkout',
                        catalogue: [{ gameId: 'oath', packageId: 'oath' }],
                        deployConfig: candidate,
                        log: () => {}
                    },
                    'oath',
                    ['logic', 'ui']
                ),
                /backendAdmin\.token/
            )
        }
        assert.deepEqual(requests, [])
    })
})

test('the environment token is detected without keeping its value', (t) => {
    t.after(() => {
        delete process.env.TABLETOP_BACKEND_ADMIN_TOKEN
    })
    process.env.TABLETOP_BACKEND_ADMIN_TOKEN = LEGACY_TOKEN
    const config = mergeEnvConfig({ backendAdmin: { url: 'http://127.0.0.1:9/invalidate' } })
    assert.deepEqual(config.backendAdmin.unsupportedSettings, ['TABLETOP_BACKEND_ADMIN_TOKEN'])
    assert.ok(!JSON.stringify(config).includes(LEGACY_TOKEN))
    assert.throws(
        () => resolveBackendAdminCredentials(config.backendAdmin),
        /TABLETOP_BACKEND_ADMIN_TOKEN/
    )
    process.env.TABLETOP_BACKEND_ADMIN_TOKEN = ''
    assert.equal(mergeEnvConfig({}).backendAdmin.unsupportedSettings, undefined)
})

test('supported credentials beside a leftover token sign in normally and never call token login', async () => {
    await withBackend(activated, async ({ requests, config }) => {
        const backendAdmin = {
            username: 'admin',
            password: PASSWORD,
            unsupportedSettings: ['backendAdmin.token', 'TABLETOP_BACKEND_ADMIN_TOKEN']
        }
        assert.deepEqual(resolveBackendAdminCredentials(backendAdmin), {
            method: 'password',
            username: 'admin',
            password: PASSWORD
        })
        const notice = describeIgnoredBackendAdminSettings(backendAdmin)
        assert.match(notice, /backendAdmin\.token and TABLETOP_BACKEND_ADMIN_TOKEN are ignored/)
        assert.equal(await invalidateBackendManifestCache(config(backendAdmin)), 'activated')
        assert.ok(!requests.some((request) => request.path.includes('/auth/token/login')))
        assert.deepEqual(
            requests.map((request) => request.path),
            ['/api/v1/auth/login', '/api/v1/admin/manifest/invalidate']
        )
        assert.equal(describeIgnoredBackendAdminSettings({ cookie: SESSION_COOKIE }), undefined)
    })
})

test('a refused invalidation reports the status, and a wrong password reports the login', async () => {
    await withBackend(
        { status: 403, body: { status: 'error', error: { name: 'AdminModeRequiredError' } } },
        async ({ config }) => {
            await assert.rejects(
                invalidateBackendManifestCache(config({ username: 'admin', password: PASSWORD })),
                /manifest invalidate 403/
            )
            await assert.rejects(
                invalidateBackendManifestCache(config({ username: 'admin', password: 'wrong' })),
                /backend login 401/
            )
        }
    )
})

test('a config without credentials names what to set', () => {
    assert.throws(
        () => resolveBackendAdminCredentials({ url: 'http://127.0.0.1:9/invalidate' }),
        /Missing backend admin credentials/
    )
    assert.throws(() => resolveBackendAdminCredentials({ username: 'admin' }), /Missing/)
})
