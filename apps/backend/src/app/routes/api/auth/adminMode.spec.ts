import { Role, UserStatus, sessionGenerationOf, type User } from '@tabletop/common'
import { RECENT_AUTHENTICATION_SECONDS, SESSION_LIFETIME_SECONDS } from '@tabletop/backend-services'
import Sensible from '@fastify/sensible'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import { authSession } from '../../../lib/session.js'
import adminMode from './adminMode.js'
import reauthenticate from './reauthenticate.js'
import logout from './logout.js'
import invalidate from '../admin/manifest/invalidate.js'
import roles from '../admin/users/roles.js'
import realtimeToken from '../realtime/token.js'
import { apiErrorShape } from '../../../tests/accountFixture.js'
import {
    memorySessions,
    sessionCookieHeader,
    sessionServer
} from '../../../tests/sessionFixture.js'

const PASSWORD = 'correct horse battery staple'

function administrator(): User {
    return {
        id: 'admin-1',
        username: 'Admin',
        status: UserStatus.Active,
        roles: [Role.User, Role.Admin],
        externalIds: []
    }
}

async function createServer(initial: User = administrator()) {
    let now = new Date('2026-10-27T12:00:00.000Z')
    const { sessionService, sessionStore } = memorySessions({ now: () => now })
    const server = await sessionServer(sessionService)
    await server.register(Sensible)
    apiErrorShape(server)
    let current = initial
    const assignRoles = vi.fn(async () => current)
    const invalidateManifestCache = vi.fn(async () => {})
    const refreshAndActivate = vi.fn(async () => {})
    const issue = vi.fn(({ topics }: { userId: string; topics: string[] }) => topics.join(','))
    Reflect.set(server, 'userService', {
        getUser: async (id: string) => (id === current.id ? current : undefined),
        getUserByUsernameAndPassword: async (username: string, password: string) =>
            username === current.username && password === PASSWORD ? current : undefined,
        assignRoles
    })
    Reflect.set(server, 'libraryService', { invalidateManifestCache, refreshAndActivate })
    Reflect.set(server, 'realtimeTokenIssuer', { issue })
    await server.register(authorization)
    await server.register(adminMode, { prefix: '/auth' })
    await server.register(reauthenticate, { prefix: '/auth' })
    await server.register(logout, { prefix: '/auth' })
    await server.register(invalidate, { prefix: '/admin/manifest' })
    await server.register(roles, { prefix: '/admin/users' })
    await server.register(realtimeToken, { prefix: '/realtime' })
    server.post('/session', async (request) => {
        await authSession({
            session: request.session,
            user: current,
            proof: 'authentication-method',
            sessions: sessionService
        })
        return {}
    })
    const login = async () => {
        const response = await server.inject({ method: 'POST', url: '/session' })
        expect(response.statusCode).toBe(200)
        const cookie = sessionCookieHeader(response)
        expect(cookie).toBeDefined()
        return cookie
    }
    const cookie = await login()
    const inject = (method: 'GET' | 'POST', url: string, payload?: object, withCookie = cookie) =>
        server.inject({ method, url, headers: { cookie: withCookie }, payload })
    return {
        server,
        sessionStore,
        cookie,
        login,
        assignRoles,
        invalidateManifestCache,
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000)),
        setAccount: (changes: Partial<User>) => {
            current = { ...current, ...changes }
        },
        advanceSessionGeneration: () => {
            current = { ...current, sessionGeneration: sessionGenerationOf(current) + 1 }
        },
        status: (withCookie = cookie) => inject('GET', '/auth/admin-mode', undefined, withCookie),
        activate: (withCookie = cookie) =>
            inject('POST', '/auth/admin-mode/activate', undefined, withCookie),
        deactivate: () => inject('POST', '/auth/admin-mode/deactivate'),
        reauthenticate: () => inject('POST', '/auth/reauthenticate', { password: PASSWORD }),
        invalidate: (payload?: object, withCookie = cookie) =>
            inject('POST', '/admin/manifest/invalidate', payload, withCookie),
        assign: () => inject('POST', '/admin/users/user-2/roles', { roles: [Role.Developer] }),
        relayToken: () => inject('GET', '/realtime/token?relayStats=true')
    }
}

describe('Admin Mode', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture(initial?: User) {
        const created = await createServer(initial)
        servers.add(created.server)
        return created
    }

    const errorName = (response: { json: () => { error?: { name?: string } } }) =>
        response.json().error?.name

    it('is off for a freshly signed-in Administrator, so administrative routes refuse them', async () => {
        const { status, invalidate, assign, assignRoles, invalidateManifestCache } = await fixture()
        expect((await status()).json()).toEqual({ status: 'ok', payload: {} })
        const refused = await invalidate()
        expect(refused.statusCode).toBe(403)
        expect(errorName(refused)).toBe('AdminModeRequiredError')
        expect((await assign()).statusCode).toBe(403)
        expect(invalidateManifestCache).not.toHaveBeenCalled()
        expect(assignRoles).not.toHaveBeenCalled()
    })

    it('refuses the manifest route to a long-lived Administrator session without Admin Mode (audit S10 proof)', async () => {
        const { advance, invalidate, activate } = await fixture()
        advance(20 * 24 * 60 * 60)
        const refused = await invalidate()
        expect(refused.statusCode).toBe(403)
        expect(errorName(refused)).toBe('AdminModeRequiredError')
        const stale = await activate()
        expect(stale.statusCode).toBe(403)
        expect(errorName(stale)).toBe('RecentAuthenticationRequiredError')
    })

    it('ignores client-supplied mode flags on an administrative request', async () => {
        const { server, cookie } = await fixture()
        const forged = await server.inject({
            method: 'POST',
            url: '/admin/manifest/invalidate?adminMode=true&adminModeExpiresAt=2099-01-01',
            headers: { cookie, 'x-admin-mode': 'true' },
            payload: { adminMode: true, principal: { adminMode: true } }
        })
        expect(forged.statusCode).toBe(403)
    })

    it('activates with Recent Authentication and then authorizes administrative routes and grants', async () => {
        const { activate, status, invalidate, assign, relayToken, sessionStore } = await fixture()
        const activated = await activate()
        expect(activated.statusCode).toBe(200)
        const expiresAt = '2026-10-27T12:15:00.000Z'
        expect(activated.json()).toEqual({ status: 'ok', payload: { adminMode: { expiresAt } } })
        expect((await status()).json()).toEqual({
            status: 'ok',
            payload: { adminMode: { expiresAt } }
        })
        expect((await invalidate()).statusCode).toBe(200)
        expect((await assign()).statusCode).toBe(200)
        expect((await relayToken()).json().payload.token).toContain('relay-stats')
        expect(sessionStore.size).toBe(1)
    })

    it('expires with the Recent Authentication window and is not revived by reauthentication', async () => {
        const { activate, advance, invalidate, status, reauthenticate, relayToken } =
            await fixture()
        expect((await activate()).statusCode).toBe(200)
        advance(RECENT_AUTHENTICATION_SECONDS - 1)
        expect((await invalidate()).statusCode).toBe(200)
        advance(1)
        expect((await invalidate()).statusCode).toBe(403)
        expect((await status()).json()).toEqual({ status: 'ok', payload: {} })
        expect((await relayToken()).json().payload.token).not.toContain('relay-stats')
        expect((await reauthenticate()).statusCode).toBe(200)
        expect((await invalidate()).statusCode).toBe(403)
        expect((await status()).json()).toEqual({ status: 'ok', payload: {} })
        const again = await activate()
        expect(again.statusCode).toBe(200)
        expect(again.json().payload.adminMode.expiresAt).toBe('2026-10-27T12:30:00.000Z')
        expect((await invalidate()).statusCode).toBe(200)
    })

    it('ends on deactivation', async () => {
        const { activate, deactivate, invalidate, status } = await fixture()
        expect((await activate()).statusCode).toBe(200)
        expect((await deactivate()).statusCode).toBe(200)
        expect((await status()).json()).toEqual({ status: 'ok', payload: {} })
        expect((await invalidate()).statusCode).toBe(403)
    })

    it('is held per session: another session of the same Administrator stays ordinary', async () => {
        const { activate, invalidate, login } = await fixture()
        const other = await login()
        expect((await activate()).statusCode).toBe(200)
        expect((await invalidate()).statusCode).toBe(200)
        expect((await invalidate(undefined, other)).statusCode).toBe(403)
    })

    it('ends with the session: logout, Session Generation change, lost role or lost Active status', async () => {
        const regenerated = await fixture()
        expect((await regenerated.activate()).statusCode).toBe(200)
        regenerated.advanceSessionGeneration()
        expect((await regenerated.invalidate()).statusCode).toBe(401)
        expect((await regenerated.status()).statusCode).toBe(401)
        expect((await regenerated.activate()).statusCode).toBe(401)
        const demoted = await fixture()
        expect((await demoted.activate()).statusCode).toBe(200)
        demoted.setAccount({ roles: [Role.User] })
        expect((await demoted.invalidate()).statusCode).toBe(403)
        expect((await demoted.activate()).statusCode).toBe(403)
        const inactive = await fixture()
        expect((await inactive.activate()).statusCode).toBe(200)
        inactive.setAccount({ status: UserStatus.Inactive })
        expect((await inactive.invalidate()).statusCode).toBe(401)
        expect((await inactive.activate()).statusCode).toBe(401)
        const loggedOut = await fixture()
        expect((await loggedOut.activate()).statusCode).toBe(200)
        const logoutResponse = await loggedOut.server.inject({
            url: '/auth/logout',
            headers: { cookie: loggedOut.cookie }
        })
        expect(logoutResponse.statusCode).toBe(200)
        expect((await loggedOut.invalidate()).statusCode).toBe(401)
    })

    it('cannot be entered by an Account without the Admin role, whatever it sends', async () => {
        const { activate, invalidate, status } = await fixture({
            ...administrator(),
            roles: [Role.User, Role.Developer]
        })
        expect((await activate()).statusCode).toBe(403)
        expect((await status()).statusCode).toBe(403)
        expect((await invalidate({ adminMode: true })).statusCode).toBe(403)
    })

    it('cannot be entered by an Incomplete Administrator', async () => {
        const { activate, invalidate } = await fixture({
            ...administrator(),
            status: UserStatus.Incomplete
        })
        expect((await activate()).statusCode).toBe(401)
        expect((await invalidate()).statusCode).toBe(401)
    })

    it('is bounded by the session lifetime', async () => {
        const { activate, advance, reauthenticate, invalidate } = await fixture()
        advance(SESSION_LIFETIME_SECONDS - 30)
        expect((await reauthenticate()).statusCode).toBe(200)
        const late = await activate()
        expect(late.statusCode).toBe(200)
        expect(late.json().payload.adminMode.expiresAt).toBe('2026-11-26T12:00:00.000Z')
        advance(30)
        expect((await invalidate()).statusCode).toBe(401)
    })
})
