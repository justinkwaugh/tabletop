import { Role, UserStatus, type User } from '@tabletop/common'
import Fastify, { type FastifyInstance } from 'fastify'
import SecureSession from '@fastify/secure-session'
import { trustedProxyChain } from '../../../../runtime/clientAddress.js'
import RateLimitPlugin from '../../../plugins/rateLimit.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import login from './login.js'
import {
    memorySessions,
    sessionCookieHeader,
    sessionServer
} from '../../../tests/sessionFixture.js'

function account(status: UserStatus): User {
    return {
        id: 'account-1',
        username: 'Person',
        email: 'person@example.test',
        status,
        roles: [Role.User],
        externalIds: []
    }
}

async function createServer(status: UserStatus) {
    const { sessionService, sessionStore } = memorySessions()
    const server = await sessionServer(sessionService)
    const user = account(status)
    server.decorate('userService', {
        getUserByUsernameAndPassword: async (username: string, password: string) =>
            username === 'Person' && password === 'correct-horse-battery' ? user : undefined,
        getUser: async (id: string) => (id === user.id ? user : undefined)
    })
    await server.register(login, { prefix: '/auth' })
    return { server, sessionStore }
}

describe('login by Account status', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture(status: UserStatus) {
        const created = await createServer(status)
        servers.add(created.server)
        return created
    }

    const passwordLogin = (server: FastifyInstance) =>
        server.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'Person', password: 'correct-horse-battery' }
        })
    it('establishes a durable session for an Active or Incomplete Account', async () => {
        for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
            const { server, sessionStore } = await fixture(status)
            const response = await passwordLogin(server)
            expect(response.statusCode).toBe(200)
            expect(response.json().payload.user.id).toBe('account-1')
            expect(sessionCookieHeader(response)).toBeDefined()
            expect(sessionStore.size).toBe(1)
        }
    })

    it('refuses an Inactive or Deleted Account with a valid password', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const { server, sessionStore } = await fixture(status)
            const response = await passwordLogin(server)
            expect(response.statusCode).toBe(401)
            expect(sessionCookieHeader(response)).toBeUndefined()
            expect(sessionStore.size).toBe(0)
        }
    })

    it('refuses a wrong password', async () => {
        const { server } = await fixture(UserStatus.Active)
        const response = await server.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'Person', password: 'wrong' }
        })
        expect(response.statusCode).toBe(401)
        expect(sessionCookieHeader(response)).toBeUndefined()
    })
})

const CLOUD_RUN_INGRESS = '169.254.169.126'
const HOSTING_PROXY = '66.249.80.9'

describe('login operation budget', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function createServer() {
        const server = Fastify({ trustProxy: trustedProxyChain('backend') })
        await server.register(SecureSession, {
            sessionName: 'session',
            cookieName: '__session',
            key: Buffer.alloc(32, 7)
        })
        await server.register(RateLimitPlugin, { service: 'backend' })
        const getUserByUsernameAndPassword = vi.fn(async () => null)
        server.decorate('userService', { getUserByUsernameAndPassword })
        await server.register(login)
        await server.ready()
        servers.add(server)
        return { server, getUserByUsernameAndPassword }
    }

    let nextAddress = 0
    async function attempt(server: ReturnType<typeof Fastify>, username: string) {
        nextAddress += 1
        const browser = `203.0.113.${nextAddress}`
        return server.inject({
            method: 'POST',
            url: '/login',
            remoteAddress: '127.0.0.1',
            headers: {
                'x-forwarded-for': `${browser}, ${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
                'fastly-client-ip': browser
            },
            payload: { username, password: 'not the password' }
        })
    }

    it('bounds attempts against one Username across many addresses', async () => {
        const { server, getUserByUsernameAndPassword } = await createServer()
        for (let index = 0; index < 20; index += 1) {
            expect((await attempt(server, 'Victim')).statusCode).toBe(401)
        }
        const exceeded = await attempt(server, ' victim ')
        expect(exceeded.statusCode).toBe(429)
        expect(Number(exceeded.headers['retry-after'])).toBeGreaterThan(0)
        expect(getUserByUsernameAndPassword).toHaveBeenCalledTimes(20)
    })

    it('keeps other Usernames unaffected by an exhausted budget', async () => {
        const { server } = await createServer()
        for (let index = 0; index < 21; index += 1) await attempt(server, 'victim')
        expect((await attempt(server, 'someone-else')).statusCode).toBe(401)
    })
})
