import { Role, UserStatus, type User } from '@tabletop/common'
import { SESSION_LIFETIME_SECONDS } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from './authorization.js'
import { authSession } from '../lib/session.js'
import update from '../routes/api/user/update.js'
import logout from '../routes/api/auth/logout.js'
import logoutAll from '../routes/api/auth/logoutAll.js'
import { memorySessions, sessionCookieHeader, sessionServer } from '../tests/sessionFixture.js'

function account(status: UserStatus): User {
    return { id: 'account-1', status, roles: [Role.User], externalIds: [] }
}

async function createServer(initialStatus: UserStatus) {
    let now = new Date('2026-10-27T12:00:00.000Z')
    const { sessionService, sessionStore } = memorySessions({ now: () => now })
    const server = await sessionServer(sessionService)
    let current = account(initialStatus)
    const updateUser = vi.fn(async () => current)
    Reflect.set(server, 'userService', {
        getUser: async (id: string) => (id === current.id ? current : undefined),
        updateUser
    })
    await server.register(authorization)
    await server.register(update, { prefix: '/user' })
    await server.register(logout, { prefix: '/auth' })
    await server.register(logoutAll, { prefix: '/auth' })
    server.post('/session', async (request) => {
        await authSession({ session: request.session, user: current, sessions: sessionService })
        return {}
    })
    server.post('/legacy-session', async (request) => {
        request.session.set('userId', current.id)
        return {}
    })
    server.get('/any', { onRequest: server.auth([server.verifyUser]) }, async (request) => ({
        id: request.user?.id,
        sessionId: request.authenticatedSession?.id
    }))
    server.get('/active', { onRequest: server.auth([server.verifyActiveUser]) }, async () => ({}))
    server.get(
        '/incomplete',
        { onRequest: server.auth([server.verifyIncompleteUser]) },
        async () => ({})
    )
    const login = async () => {
        const response = await server.inject({ method: 'POST', url: '/session' })
        expect(response.statusCode).toBe(200)
        const cookie = sessionCookieHeader(response)
        expect(cookie).toBeDefined()
        return cookie
    }
    const cookie = await login()
    return {
        server,
        updateUser,
        sessionStore,
        cookie,
        login,
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000)),
        setStatus: (status: UserStatus) => {
            current = account(status)
        },
        get: (url: string, withCookie = cookie) =>
            server.inject({ url, headers: { cookie: withCookie } }),
        post: (url: string, withCookie = cookie) =>
            server.inject({ method: 'POST', url, headers: { cookie: withCookie } }),
        emptyProfileUpdate: () =>
            server.inject({ method: 'POST', url: '/user/update', headers: { cookie }, payload: {} })
    }
}

describe('session authorization by Account status', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture(initialStatus: UserStatus) {
        const created = await createServer(initialStatus)
        servers.add(created.server)
        return created
    }

    it('lets an Active Account use any session-authorized route except onboarding', async () => {
        const { get } = await fixture(UserStatus.Active)
        expect((await get('/any')).json()).toMatchObject({ id: 'account-1' })
        expect((await get('/active')).statusCode).toBe(200)
        expect((await get('/incomplete')).statusCode).toBe(401)
    })

    it('limits an Incomplete Account to session and onboarding routes', async () => {
        const { get } = await fixture(UserStatus.Incomplete)
        expect((await get('/any')).statusCode).toBe(200)
        expect((await get('/active')).statusCode).toBe(401)
        expect((await get('/incomplete')).statusCode).toBe(200)
    })

    it('stops honouring an existing session once the Account is Inactive or Deleted', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const { get, setStatus } = await fixture(UserStatus.Active)
            expect((await get('/any')).statusCode).toBe(200)
            setStatus(status)
            expect((await get('/any')).statusCode).toBe(401)
            expect((await get('/active')).statusCode).toBe(401)
            expect((await get('/incomplete')).statusCode).toBe(401)
        }
    })

    it('rejects an empty profile update from an Inactive Account before it reaches the service', async () => {
        const { emptyProfileUpdate, setStatus, updateUser } = await fixture(UserStatus.Active)
        setStatus(UserStatus.Inactive)
        const response = await emptyProfileUpdate()
        expect(response.statusCode).toBe(401)
        expect(updateUser).not.toHaveBeenCalled()
    })

    it('rejects a request without a session', async () => {
        const { server } = await fixture(UserStatus.Active)
        expect((await server.inject({ url: '/any' })).statusCode).toBe(401)
    })
})

describe('revocable Authenticated Sessions', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture() {
        const created = await createServer(UserStatus.Active)
        servers.add(created.server)
        return created
    }

    it('exposes the durable session behind the cookie to the route', async () => {
        const { get, sessionStore } = await fixture()
        const { sessionId } = (await get('/any')).json()
        expect(sessionId).toMatch(/^[0-9A-Za-z]{32}$/)
        await expect(sessionStore.find(sessionId)).resolves.toMatchObject({ userId: 'account-1' })
    })

    it('refuses a copied cookie after the session logs out', async () => {
        const { get, sessionStore } = await fixture()
        expect((await get('/any')).statusCode).toBe(200)
        expect((await get('/auth/logout')).statusCode).toBe(200)
        expect((await get('/any')).statusCode).toBe(401)
        expect((await get('/active')).statusCode).toBe(401)
        expect(sessionStore.size).toBe(0)
    })

    it('answers logout without a live session and still clears the cookie', async () => {
        const { get, server } = await fixture()
        expect((await get('/auth/logout')).statusCode).toBe(200)
        const again = await get('/auth/logout')
        expect(again.statusCode).toBe(200)
        expect((await server.inject({ url: '/auth/logout' })).statusCode).toBe(200)
    })

    it('keeps concurrent sessions independent until Logout All ends every one', async () => {
        const { get, post, login, sessionStore } = await fixture()
        const second = await login()
        const third = await login()
        expect(sessionStore.size).toBe(3)
        expect((await get('/auth/logout', second)).statusCode).toBe(200)
        expect((await get('/any', second)).statusCode).toBe(401)
        expect((await get('/any')).statusCode).toBe(200)
        expect((await get('/any', third)).statusCode).toBe(200)
        expect((await post('/auth/logoutAll', third)).statusCode).toBe(200)
        expect(sessionStore.size).toBe(0)
        expect((await get('/any')).statusCode).toBe(401)
        expect((await get('/any', third)).statusCode).toBe(401)
    })

    it('requires a live session for Logout All', async () => {
        const { post, server } = await fixture()
        expect((await server.inject({ method: 'POST', url: '/auth/logoutAll' })).statusCode).toBe(
            401
        )
        expect((await post('/auth/logoutAll')).statusCode).toBe(200)
        expect((await post('/auth/logoutAll')).statusCode).toBe(401)
    })

    it('refuses a legacy cookie that names a user without a durable session', async () => {
        const { server, get } = await fixture()
        const legacy = await server.inject({ method: 'POST', url: '/legacy-session' })
        const cookie = sessionCookieHeader(legacy)
        expect(cookie).toBeDefined()
        expect((await get('/any', cookie)).statusCode).toBe(401)
        expect((await get('/active', cookie)).statusCode).toBe(401)
    })

    it('refuses a session after its thirty-day absolute lifetime', async () => {
        const { get, advance, sessionStore } = await fixture()
        advance(SESSION_LIFETIME_SECONDS - 60)
        expect((await get('/any')).statusCode).toBe(200)
        advance(60)
        expect((await get('/any')).statusCode).toBe(401)
        expect(sessionStore.size).toBe(0)
    })

    it('replaces the previous session when the same browser signs in again', async () => {
        const { server, get, sessionStore, cookie } = await fixture()
        const previous = (await get('/any')).json().sessionId
        const again = await server.inject({
            method: 'POST',
            url: '/session',
            headers: { cookie }
        })
        expect(again.statusCode).toBe(200)
        const renewed = sessionCookieHeader(again)
        expect(renewed).toBeDefined()
        expect(sessionStore.size).toBe(1)
        await expect(sessionStore.find(previous)).resolves.toBeUndefined()
        expect((await get('/any')).statusCode).toBe(401)
        expect((await get('/any', renewed)).statusCode).toBe(200)
    })
})
