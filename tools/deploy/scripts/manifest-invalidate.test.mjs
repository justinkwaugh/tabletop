import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { afterEach } from 'node:test'
import { invalidateBackendManifestCache } from '../esm/lib/backend.js'
import { mergeEnvConfig, readDeployConfig } from '../esm/lib/config.js'

const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})

const credentials = {
    backendManifestUrl: 'https://backend.example/api/v1/manifest',
    backendAdmin: { username: 'deploy', password: 'secret' }
}
const providedCookie = {
    backendManifestUrl: 'https://backend.example/api/v1/manifest',
    backendAdmin: { cookie: 'sessionId=browser' }
}

const json =
    (body, init = {}) =>
    () =>
        new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
            ...init
        })
const refusal = (status, statusText, name, message) =>
    json({ status: 'error', error: { name, message } }, { status, statusText })
const notFound = () => new Response('', { status: 404, statusText: 'Not Found' })

// Records every request the tool makes, in order, and answers each backend route as scripted.
function fakeBackend({
    activation = json({
        status: 'ok',
        payload: { adminMode: { expiresAt: '2026-10-27T12:15:00Z' } }
    }),
    invalidation = json({ replacement: 'none' }),
    logout = json({ status: 'ok', payload: {} })
} = {}) {
    const requests = []
    globalThis.fetch = async (input, init = {}) => {
        if (init.signal?.aborted) throw new DOMException('This operation was aborted', 'AbortError')
        const url = new URL(input)
        requests.push({
            path: url.pathname,
            method: init.method ?? 'GET',
            cookie: init.headers?.cookie,
            body: init.body
        })
        switch (url.pathname) {
            case '/api/v1/auth/login':
                return new Response(JSON.stringify({ status: 'ok', payload: {} }), {
                    headers: {
                        'content-type': 'application/json',
                        'set-cookie': 'sessionId=signed-in; Path=/; HttpOnly; Secure'
                    }
                })
            case '/api/v1/auth/admin-mode/activate':
                return activation()
            case '/api/v1/admin/manifest/invalidate':
                return invalidation()
            case '/api/v1/auth/logout':
                return logout()
            default:
                return notFound()
        }
    }
    return requests
}

const paths = (requests) => requests.map((request) => request.path)

test('signs in, enters Admin Mode, invalidates with that session and signs out', async () => {
    const requests = fakeBackend()
    const result = await invalidateBackendManifestCache(credentials)
    assert.equal(result, 'none')
    assert.deepEqual(paths(requests), [
        '/api/v1/auth/login',
        '/api/v1/auth/admin-mode/activate',
        '/api/v1/admin/manifest/invalidate',
        '/api/v1/auth/logout'
    ])
    assert.equal(requests[0].method, 'POST')
    assert.equal(requests[0].body, JSON.stringify({ username: 'deploy', password: 'secret' }))
    assert.equal(requests[0].cookie, undefined)
    for (const request of requests.slice(1)) {
        assert.equal(request.cookie, 'sessionId=signed-in')
    }
    assert.equal(requests[1].method, 'POST')
    assert.equal(requests[2].method, 'POST')
})

test('a provided cookie is used as it is: no sign-in, no sign-out, Admin Mode still entered', async () => {
    const requests = fakeBackend({
        invalidation: json({ activation: 'complete' })
    })
    const result = await invalidateBackendManifestCache(providedCookie)
    assert.equal(result, 'activated')
    assert.deepEqual(paths(requests), [
        '/api/v1/auth/admin-mode/activate',
        '/api/v1/admin/manifest/invalidate'
    ])
    for (const request of requests) {
        assert.equal(request.cookie, 'sessionId=browser')
    }
})

test('a provided cookie without Recent Authentication stops before the invalidation', async () => {
    const requests = fakeBackend({
        activation: refusal(
            403,
            'Forbidden',
            'RecentAuthenticationRequiredError',
            'This operation requires Recent Authentication'
        )
    })
    await assert.rejects(
        invalidateBackendManifestCache(providedCookie),
        /admin-mode activation 403 Forbidden .*did not sign in within the last 15 minutes.*backendAdmin\.username and password/
    )
    assert.deepEqual(paths(requests), ['/api/v1/auth/admin-mode/activate'])
})

test('an account without the Admin role is refused and the signed-in session is still released', async () => {
    const requests = fakeBackend({
        activation: refusal(403, 'Forbidden', 'ForbiddenError', 'User does not have Admin role')
    })
    await assert.rejects(
        invalidateBackendManifestCache(credentials),
        /admin-mode activation 403 Forbidden \(User does not have Admin role\): the account is not an Administrator/
    )
    assert.deepEqual(paths(requests), [
        '/api/v1/auth/login',
        '/api/v1/auth/admin-mode/activate',
        '/api/v1/auth/logout'
    ])
})

test('a backend without Admin Mode activation is reported as needing release first', async () => {
    const requests = fakeBackend({ activation: notFound })
    await assert.rejects(
        invalidateBackendManifestCache(credentials),
        /admin-mode activation 404 Not Found: this backend predates server-held Admin Mode; release the backend from this checkout/
    )
    assert.ok(!paths(requests).includes('/api/v1/admin/manifest/invalidate'))
})

test('a session the backend no longer holds is reported as not live', async () => {
    fakeBackend({
        activation: refusal(401, 'Unauthorized', 'SessionNotLiveError', 'Session is not live')
    })
    await assert.rejects(
        invalidateBackendManifestCache(providedCookie),
        /admin-mode activation 401 Unauthorized \(Session is not live\): the session is not live/
    )
})

test('an abort during activation prevents the invalidation and warns about the sign-out', async () => {
    const controller = new AbortController()
    const requests = fakeBackend({
        activation: () => {
            controller.abort()
            throw new DOMException('This operation was aborted', 'AbortError')
        }
    })
    const warnings = []
    await assert.rejects(
        invalidateBackendManifestCache(credentials, {
            signal: controller.signal,
            warn: (message) => warnings.push(message)
        }),
        { name: 'AbortError' }
    )
    assert.deepEqual(paths(requests), ['/api/v1/auth/login', '/api/v1/auth/admin-mode/activate'])
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /backend sign-out failed/)
})

test('a refused invalidation reports the backend reason', async () => {
    fakeBackend({
        invalidation: refusal(
            403,
            'Forbidden',
            'AdminModeRequiredError',
            'This operation requires Admin Mode'
        )
    })
    await assert.rejects(
        invalidateBackendManifestCache(credentials),
        /manifest invalidate 403 Forbidden \(This operation requires Admin Mode\)/
    )
})

test('a failed sign-out is a warning, not a failed invalidation', async () => {
    fakeBackend({ logout: refusal(500, 'Internal Server Error', 'Error', 'boom') })
    const warnings = []
    const result = await invalidateBackendManifestCache(credentials, {
        warn: (message) => warnings.push(message)
    })
    assert.equal(result, 'none')
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /backend sign-out failed \(backend logout 500/)
    assert.match(warnings[0], /within 15 minutes/)
})

test('without credentials nothing is requested', async () => {
    const requests = fakeBackend()
    await assert.rejects(
        invalidateBackendManifestCache({ backendManifestUrl: credentials.backendManifestUrl }),
        /Missing backend admin credentials.*backendAdmin\.username and password, or backendAdmin\.cookie/
    )
    assert.deepEqual(requests, [])
})

test('a legacy token setting is no longer a credential', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'deploy-config-'))
    try {
        const configPath = path.join(directory, 'deploy.config.json')
        await writeFile(
            configPath,
            JSON.stringify({
                backendManifestUrl: credentials.backendManifestUrl,
                backendAdmin: { token: 'legacy-token' }
            })
        )
        const fromFile = await readDeployConfig(configPath)
        assert.deepEqual(fromFile.backendAdmin, {
            url: undefined,
            username: undefined,
            password: undefined,
            cookie: undefined,
            unsupportedSettings: ['backendAdmin.token']
        })
        process.env.TABLETOP_BACKEND_ADMIN_TOKEN = 'legacy-token'
        try {
            const merged = mergeEnvConfig(fromFile)
            assert.ok(!('token' in merged.backendAdmin))
            assert.ok(!JSON.stringify(merged).includes('legacy-token'))
            const requests = fakeBackend()
            await assert.rejects(
                invalidateBackendManifestCache(merged),
                /given only as TABLETOP_BACKEND_ADMIN_TOKEN and backendAdmin\.token.*no longer supports/
            )
            assert.deepEqual(requests, [])
        } finally {
            delete process.env.TABLETOP_BACKEND_ADMIN_TOKEN
        }
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
