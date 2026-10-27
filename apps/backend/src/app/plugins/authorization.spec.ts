import { Role, UserStatus, type User } from '@tabletop/common'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from './authorization.js'
import { authSession } from '../lib/session.js'
import update from '../routes/api/user/update.js'
import { sessionCookieHeader, sessionServer } from '../tests/sessionFixture.js'

function account(status: UserStatus): User {
    return { id: 'account-1', status, roles: [Role.User], externalIds: [] }
}

async function createServer(initialStatus: UserStatus) {
    const server = await sessionServer()
    let current = account(initialStatus)
    const updateUser = vi.fn(async () => current)
    Reflect.set(server, 'userService', {
        getUser: async (id: string) => (id === current.id ? current : undefined),
        updateUser
    })
    await server.register(authorization)
    await server.register(update, { prefix: '/user' })
    server.post('/session', async (request) => {
        authSession({ session: request.session, user: current })
        return {}
    })
    server.get('/any', { onRequest: server.auth([server.verifyUser]) }, async (request) => ({
        id: request.user?.id
    }))
    server.get('/active', { onRequest: server.auth([server.verifyActiveUser]) }, async () => ({}))
    server.get(
        '/incomplete',
        { onRequest: server.auth([server.verifyIncompleteUser]) },
        async () => ({})
    )
    const login = await server.inject({ method: 'POST', url: '/session' })
    expect(login.statusCode).toBe(200)
    const cookie = sessionCookieHeader(login)
    expect(cookie).toBeDefined()
    return {
        server,
        updateUser,
        setStatus: (status: UserStatus) => {
            current = account(status)
        },
        get: (url: string) => server.inject({ url, headers: { cookie } }),
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
        expect((await get('/any')).json()).toEqual({ id: 'account-1' })
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
