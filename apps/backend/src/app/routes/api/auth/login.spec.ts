import { Role, UserStatus, type User } from '@tabletop/common'
import { TokenType } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import login from './login.js'
import tokenLogin from './token/login.js'
import { sessionCookieHeader, sessionServer } from '../../../tests/sessionFixture.js'

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
    const server = await sessionServer()
    const user = account(status)
    server.decorate('userService', {
        getUserByUsernameAndPassword: async (username: string, password: string) =>
            username === 'Person' && password === 'correct-horse-battery' ? user : undefined,
        getUser: async (id: string) => (id === user.id ? user : undefined)
    })
    server.decorate('tokenService', {
        getData: async ({ token, expectedType }: { token: string; expectedType: TokenType }) =>
            token === 'challenge' && expectedType === TokenType.Authentication
                ? { userId: user.id, email: user.email }
                : undefined
    })
    await server.register(login, { prefix: '/auth' })
    await server.register(tokenLogin, { prefix: '/auth/token' })
    return server
}

describe('login by Account status', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture(status: UserStatus) {
        const server = await createServer(status)
        servers.add(server)
        return server
    }

    const passwordLogin = (server: FastifyInstance) =>
        server.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'Person', password: 'correct-horse-battery' }
        })
    const challengeLogin = (server: FastifyInstance) =>
        server.inject({ method: 'POST', url: '/auth/token/login', payload: { token: 'challenge' } })

    it('establishes a session for an Active or Incomplete Account', async () => {
        for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
            const server = await fixture(status)
            for (const attempt of [passwordLogin, challengeLogin]) {
                const response = await attempt(server)
                expect(response.statusCode).toBe(200)
                expect(response.json().payload.user.id).toBe('account-1')
                expect(sessionCookieHeader(response)).toBeDefined()
            }
        }
    })

    it('refuses an Inactive or Deleted Account with a valid password or challenge', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const server = await fixture(status)
            for (const attempt of [passwordLogin, challengeLogin]) {
                const response = await attempt(server)
                expect(response.statusCode).toBe(401)
                expect(sessionCookieHeader(response)).toBeUndefined()
            }
        }
    })

    it('refuses a wrong password', async () => {
        const server = await fixture(UserStatus.Active)
        const response = await server.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'Person', password: 'wrong' }
        })
        expect(response.statusCode).toBe(401)
        expect(sessionCookieHeader(response)).toBeUndefined()
    })
})
