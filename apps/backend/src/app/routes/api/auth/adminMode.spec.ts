import { randomBytes } from 'node:crypto'
import { Role, UserStatus, type User } from '@tabletop/common'
import {
    LibraryService,
    type ManifestCache,
    type MessagePublisher,
    RECENT_AUTHENTICATION_SECONDS,
    RealtimeControl,
    type RealtimeRevocation,
    RealtimeTokenIssuer,
    SESSION_LIFETIME_SECONDS,
    UserService
} from '@tabletop/backend-services'
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
import {
    apiErrorShape,
    memoryChallenges,
    memoryUserStore,
    recordingTasks
} from '../../../tests/accountFixture.js'
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
        email: 'admin@example.test',
        emailVerified: true,
        status: UserStatus.Active,
        roles: [Role.User, Role.Admin],
        externalIds: []
    }
}

// The library never reaches the cache here: the manifest routes are stubbed on the instance
class MemoryManifestCache implements ManifestCache {
    async cachingGet<T>(): Promise<T | undefined> {
        return undefined
    }

    async delete(): Promise<void> {}
}

type TokenClaims = { topics: string[]; until?: Record<string, number>; iat: number; exp: number }

function claimsOf(token: string): TokenClaims {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
}

async function createServer(initial: User = administrator()) {
    let now = new Date('2026-10-27T12:00:00.000Z')
    const revocations: RealtimeRevocation[] = []
    const relay: MessagePublisher = {
        publishMessage: async ({ message }) => {
            revocations.push(JSON.parse(message))
        }
    }
    const { sessionService, sessionStore } = memorySessions({
        now: () => now,
        realtime: new RealtimeControl(relay, () => now)
    })
    const server = await sessionServer(sessionService)
    apiErrorShape(server)
    const { store, account } = memoryUserStore(initial, PASSWORD)
    const userService = new UserService(
        store,
        memoryChallenges({ now: () => now }).challengeService,
        recordingTasks().tasks
    )
    const assignRoles = vi.spyOn(userService, 'assignRoles')
    const library = new LibraryService(new MemoryManifestCache(), { useCache: false })
    const invalidateManifestCache = vi
        .spyOn(library, 'invalidateManifestCache')
        .mockResolvedValue(undefined)
    const served = { frontend: { version: '0.0.0' }, games: [] }
    vi.spyOn(library, 'refreshAndActivate').mockResolvedValue(served)
    vi.spyOn(library, 'getServedManifest').mockResolvedValue(served)
    server.decorate('userService', userService)
    server.decorate('libraryService', library)
    server.decorate(
        'realtimeTokenIssuer',
        new RealtimeTokenIssuer(
            { kid: 'spec', key: randomBytes(32) },
            () => now.getTime(),
            () => 'token-id'
        )
    )
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
            user: account(),
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
        revocations,
        assignRoles,
        invalidateManifestCache,
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000)),
        demote: () => store.updateUser({ userId: initial.id, fields: { roles: [Role.User] } }),
        deactivateAccount: () =>
            store.updateUser({ userId: initial.id, fields: { status: UserStatus.Inactive } }),
        advanceSessionGeneration: () =>
            store.updatePassword(initial.id, 'another password entirely'),
        status: (withCookie = cookie) => inject('GET', '/auth/admin-mode', undefined, withCookie),
        activate: (withCookie = cookie) =>
            inject('POST', '/auth/admin-mode/activate', undefined, withCookie),
        deactivate: () => inject('POST', '/auth/admin-mode/deactivate'),
        reauthenticate: () => inject('POST', '/auth/reauthenticate', { password: PASSWORD }),
        logout: (withCookie = cookie) => inject('GET', '/auth/logout', undefined, withCookie),
        invalidate: (payload?: object, withCookie = cookie) =>
            inject('POST', '/admin/manifest/invalidate', payload, withCookie),
        assign: () =>
            inject('POST', `/admin/users/${initial.id}/roles`, { roles: [Role.Developer] }),
        relayToken: async () => {
            const response = await inject('GET', '/realtime/token?relayStats=true')
            expect(response.statusCode).toBe(200)
            return claimsOf(response.json().payload.token)
        }
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

    const statsRevocation = (at: number): RealtimeRevocation => ({
        revoke: 'admin-1',
        topics: ['relay-stats'],
        at
    })

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
        const { activate, status, invalidate, assign, assignRoles, relayToken, sessionStore } =
            await fixture()
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
        expect(assignRoles).toHaveBeenCalledWith('admin-1', [Role.Developer])
        expect((await relayToken()).topics).toContain('relay-stats')
        expect(sessionStore.size).toBe(1)
    })

    it('grants the relay-stats topic only up to the end of the mode, whatever the token lifetime', async () => {
        const { activate, advance, relayToken } = await fixture()
        expect((await activate()).statusCode).toBe(200)
        const modeEnd = Date.parse('2026-10-27T12:15:00.000Z') / 1000
        const fresh = await relayToken()
        expect(fresh.until).toEqual({ 'relay-stats': modeEnd })
        expect(fresh.exp - fresh.iat).toBe(60)
        advance(RECENT_AUTHENTICATION_SECONDS - 1)
        const late = await relayToken()
        expect(late.topics).toContain('relay-stats')
        expect(late.until).toEqual({ 'relay-stats': modeEnd })
        expect(late.exp).toBeGreaterThan(modeEnd)
        advance(1)
        const lapsed = await relayToken()
        expect(lapsed.topics).not.toContain('relay-stats')
        expect(lapsed).not.toHaveProperty('until')
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
        expect((await relayToken()).topics).not.toContain('relay-stats')
        expect((await reauthenticate()).statusCode).toBe(200)
        expect((await invalidate()).statusCode).toBe(403)
        expect((await status()).json()).toEqual({ status: 'ok', payload: {} })
        const again = await activate()
        expect(again.statusCode).toBe(200)
        expect(again.json().payload.adminMode.expiresAt).toBe('2026-10-27T12:30:00.000Z')
        expect((await invalidate()).statusCode).toBe(200)
    })

    it('ends on deactivation and tells the relay to end the stats grant', async () => {
        const { activate, deactivate, invalidate, status, revocations, advance } = await fixture()
        expect((await activate()).statusCode).toBe(200)
        expect(revocations).toEqual([])
        advance(20)
        expect((await deactivate()).statusCode).toBe(200)
        expect(revocations).toEqual([statsRevocation(Date.parse('2026-10-27T12:00:20Z') / 1000)])
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
        await regenerated.advanceSessionGeneration()
        expect((await regenerated.invalidate()).statusCode).toBe(401)
        expect((await regenerated.status()).statusCode).toBe(401)
        expect((await regenerated.activate()).statusCode).toBe(401)
        const demoted = await fixture()
        expect((await demoted.activate()).statusCode).toBe(200)
        await demoted.demote()
        expect((await demoted.invalidate()).statusCode).toBe(403)
        expect((await demoted.activate()).statusCode).toBe(403)
        const inactive = await fixture()
        expect((await inactive.activate()).statusCode).toBe(200)
        await inactive.deactivateAccount()
        expect((await inactive.invalidate()).statusCode).toBe(401)
        expect((await inactive.activate()).statusCode).toBe(401)
        const loggedOut = await fixture()
        expect((await loggedOut.activate()).statusCode).toBe(200)
        expect((await loggedOut.logout()).statusCode).toBe(200)
        expect((await loggedOut.invalidate()).statusCode).toBe(401)
        expect(loggedOut.revocations).toEqual([
            statsRevocation(Date.parse('2026-10-27T12:00:00Z') / 1000)
        ])
    })

    it('tells the relay nothing when a session outside the mode logs out', async () => {
        const { logout, login, activate, revocations } = await fixture()
        const other = await login()
        expect((await activate()).statusCode).toBe(200)
        expect((await logout(other)).statusCode).toBe(200)
        expect(revocations).toEqual([])
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
        const { activate, advance, reauthenticate, invalidate, relayToken } = await fixture()
        advance(SESSION_LIFETIME_SECONDS - 30)
        expect((await reauthenticate()).statusCode).toBe(200)
        const late = await activate()
        expect(late.statusCode).toBe(200)
        expect(late.json().payload.adminMode.expiresAt).toBe('2026-11-26T12:00:00.000Z')
        expect((await relayToken()).until).toEqual({
            'relay-stats': Date.parse('2026-11-26T12:00:00.000Z') / 1000
        })
        advance(30)
        expect((await invalidate()).statusCode).toBe(401)
    })
})
