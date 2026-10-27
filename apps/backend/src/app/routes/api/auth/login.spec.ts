import { Role, UserStatus, type User } from '@tabletop/common'
import { TokenType } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import login from './login.js'
import tokenLogin from './token/login.js'
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
        getUserForAuthorization: async (id: string) => (id === user.id ? user : undefined)
    })
    server.decorate('tokenService', {
        getData: async ({ token, expectedType }: { token: string; expectedType: TokenType }) =>
            token === 'challenge' && expectedType === TokenType.Authentication
                ? { userId: user.id, email: user.email }
                : undefined
    })
    await server.register(login, { prefix: '/auth' })
    await server.register(tokenLogin, { prefix: '/auth/token' })
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
    const challengeLogin = (server: FastifyInstance) =>
        server.inject({ method: 'POST', url: '/auth/token/login', payload: { token: 'challenge' } })

    it('establishes a durable session for an Active or Incomplete Account', async () => {
        for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
            const { server, sessionStore } = await fixture(status)
            let established = 0
            for (const attempt of [passwordLogin, challengeLogin]) {
                const response = await attempt(server)
                expect(response.statusCode).toBe(200)
                expect(response.json().payload.user.id).toBe('account-1')
                expect(sessionCookieHeader(response)).toBeDefined()
                expect(sessionStore.size).toBe(++established)
            }
        }
    })

    it('refuses an Inactive or Deleted Account with a valid password or challenge', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const { server, sessionStore } = await fixture(status)
            for (const attempt of [passwordLogin, challengeLogin]) {
                const response = await attempt(server)
                expect(response.statusCode).toBe(401)
                expect(sessionCookieHeader(response)).toBeUndefined()
            }
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
