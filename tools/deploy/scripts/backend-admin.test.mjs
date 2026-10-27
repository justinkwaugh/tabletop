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
// cookie, Admin Mode activation needs that cookie (and, for a provided cookie, Recent
// Authentication the fixture can refuse), manifest invalidation needs the activated session, and
// logout ends it.
async function withBackend(invalidateResponse, run, { activation = { status: 200 } } = {}) {
    const requests = []
    let adminMode = false
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
            if (request.method === 'POST' && request.url === '/api/v1/auth/admin-mode/activate') {
                if (request.headers.cookie !== SESSION_COOKIE) {
                    response.writeHead(401, { 'content-type': 'application/json' })
                    response.end(
                        JSON.stringify({ status: 'error', error: { name: 'Unauthorized' } })
                    )
                    return
                }
                if (activation.status !== 200) {
                    response.writeHead(activation.status, { 'content-type': 'application/json' })
                    response.end(JSON.stringify(activation.body))
                    return
                }
                adminMode = true
                response.writeHead(200, { 'content-type': 'application/json' })
                response.end(
                    JSON.stringify({
                        status: 'ok',
                        payload: { adminMode: { expiresAt: '2026-10-27T12:15:00Z' } }
                    })
                )
                return
            }
            if (request.method === 'GET' && request.url === '/api/v1/auth/logout') {
                adminMode = false
                response.writeHead(200, { 'content-type': 'application/json' })
                response.end(JSON.stringify({ status: 'ok', payload: {} }))
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
                if (!adminMode) {
                    response.writeHead(403, { 'content-type': 'application/json' })
                    response.end(
                        JSON.stringify({
                            status: 'error',
                            error: {
                                name: 'AdminModeRequiredError',
                                message: 'This operation requires Admin Mode'
                            }
                        })
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

const SIGNED_IN_FLOW = [
    '/api/v1/auth/login',
    '/api/v1/auth/admin-mode/activate',
    '/api/v1/admin/manifest/invalidate',
    '/api/v1/auth/logout'
]

test('username and password sign in once, enter Admin Mode, invalidate with the issued session cookie and sign out', async () => {
    await withBackend(activated, async ({ requests, config }) => {
        const result = await invalidateBackendManifestCache(
            config({ username: 'admin', password: PASSWORD })
        )
        assert.equal(result, 'activated')
        assert.deepEqual(
            requests.map((request) => request.path),
            SIGNED_IN_FLOW
        )
        for (const request of requests.slice(1)) {
            assert.equal(request.headers.cookie, SESSION_COOKIE)
        }
    })
})

test('a configured cookie is sent as it is without signing in or out, and still enters Admin Mode', async () => {
    await withBackend(
        { status: 200, body: { status: 'ok', replacement: 'superseded' } },
        async ({ requests, config }) => {
            const result = await invalidateBackendManifestCache(config({ cookie: SESSION_COOKIE }))
            assert.equal(result, 'superseded')
            assert.deepEqual(
                requests.map((request) => request.path),
                ['/api/v1/auth/admin-mode/activate', '/api/v1/admin/manifest/invalidate']
            )
            for (const request of requests) {
                assert.equal(request.headers.cookie, SESSION_COOKIE)
            }
        }
    )
})

test('a configured cookie older than Recent Authentication is refused before the invalidation', async () => {
    await withBackend(
        activated,
        async ({ requests, config }) => {
            await assert.rejects(
                invalidateBackendManifestCache(config({ cookie: SESSION_COOKIE })),
                /admin-mode activation 403 Forbidden .*did not sign in within the last 15 minutes.*backendAdmin\.username and password/
            )
            assert.deepEqual(
                requests.map((request) => request.path),
                ['/api/v1/auth/admin-mode/activate']
            )
        },
        {
            activation: {
                status: 403,
                body: {
                    status: 'error',
                    error: {
                        name: 'RecentAuthenticationRequiredError',
                        message: 'This operation requires Recent Authentication'
                    }
                }
            }
        }
    )
})

test('the invalidation is refused without Admin Mode', async () => {
    // Proves the fixture models the S10 backend: a session that signed in but never activated
    // the mode gets 403 AdminModeRequiredError from the invalidation.
    await withBackend(activated, async ({ origin, requests }) => {
        const login = await fetch(`${origin}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: PASSWORD })
        })
        assert.equal(login.status, 200)
        const refused = await fetch(`${origin}/api/v1/admin/manifest/invalidate`, {
            method: 'POST',
            headers: { cookie: SESSION_COOKIE }
        })
        assert.equal(refused.status, 403)
        assert.equal((await refused.json()).error.name, 'AdminModeRequiredError')
        assert.deepEqual(
            requests.map((request) => request.path),
            ['/api/v1/auth/login', '/api/v1/admin/manifest/invalidate']
        )
    })
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
            SIGNED_IN_FLOW
        )
        assert.equal(describeIgnoredBackendAdminSettings({ cookie: SESSION_COOKIE }), undefined)
    })
})

test('a refused invalidation reports the status and still signs out, and a wrong password reports the login', async () => {
    await withBackend(
        { status: 503, body: { status: 'error', error: { name: 'ServiceUnavailable' } } },
        async ({ requests, config }) => {
            await assert.rejects(
                invalidateBackendManifestCache(config({ username: 'admin', password: PASSWORD })),
                /manifest invalidate 503/
            )
            assert.deepEqual(
                requests.map((request) => request.path),
                SIGNED_IN_FLOW
            )
            requests.length = 0
            await assert.rejects(
                invalidateBackendManifestCache(config({ username: 'admin', password: 'wrong' })),
                /backend login 401/
            )
            assert.deepEqual(
                requests.map((request) => request.path),
                ['/api/v1/auth/login']
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
