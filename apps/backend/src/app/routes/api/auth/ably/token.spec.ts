import fastifyAuth from '@fastify/auth'
import SecureSession from '@fastify/secure-session'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify, { type FastifyRequest } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import tokenRoute from './token.js'
import RateLimitPlugin from '../../../../plugins/rateLimit.js'

vi.mock('@tabletop/backend-services', () => ({
    GLOBAL_TOPIC: 'global',
    RELAY_STATS_TOPIC: 'relay-stats',
    userTopic: (userId: string) => `user-${userId}`,
    gameTopic: (gameId: string) => `game-${gameId}`
}))

const user: User = {
    id: 'u1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer({ roles = [Role.User] }: { roles?: Role[] } = {}) {
    const server = Fastify()
    await server.register(SecureSession, {
        sessionName: 'session',
        cookieName: '__session',
        key: Buffer.alloc(32, 7)
    })
    await server.register(fastifyAuth)
    await server.register(RateLimitPlugin, { service: 'local' })
    server.decorate('verifyActiveUser', async (request: FastifyRequest) => {
        const accountId = request.headers['x-test-user']
        request.user = { ...user, roles, id: typeof accountId === 'string' ? accountId : user.id }
        request.session.set('userId', request.user.id)
    })
    server.decorate('verifyRoleUser', async () => undefined)
    const createTokenRequest = vi.fn(
        async ({ userId, topics }: { userId: string; topics: string[] }) => ({
            clientId: userId,
            capability: JSON.stringify(
                Object.fromEntries(topics.map((topic) => [topic, ['subscribe']]))
            )
        })
    )
    server.decorate('ablyService', { createTokenRequest })
    await server.register(tokenRoute)
    return { server, createTokenRequest }
}

describe('GET /auth/ably/token', () => {
    const servers: ReturnType<typeof Fastify>[] = []

    afterEach(async () => {
        await Promise.all(servers.map((server) => server.close()))
        servers.length = 0
    })

    it('grants subscribe on the caller user topic and the global topic only', async () => {
        const { server, createTokenRequest } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token' })
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(createTokenRequest).toHaveBeenCalledWith({
            userId: 'u1',
            topics: ['user-u1', 'global']
        })
        expect(JSON.parse(response.json().payload.token.capability)).toEqual({
            'user-u1': ['subscribe'],
            global: ['subscribe']
        })
    })

    it('adds a topic for each requested game without looking the game up', async () => {
        const { server, createTokenRequest } = await createServer()
        servers.push(server)
        const response = await server.inject({
            method: 'GET',
            url: '/token?game=g1&game=g2&game=g1'
        })
        expect(response.statusCode).toBe(200)
        expect(createTokenRequest).toHaveBeenCalledWith({
            userId: 'u1',
            topics: ['user-u1', 'global', 'game-g1', 'game-g2']
        })
    })

    it('never grants another account user topic or the relay stats topic', async () => {
        const { server, createTokenRequest } = await createServer({
            roles: [Role.User, Role.Admin]
        })
        servers.push(server)
        const response = await server.inject({
            method: 'GET',
            url: '/token?game=g1&user=u2&relayStats=true'
        })
        expect(response.statusCode).toBe(200)
        expect(createTokenRequest).toHaveBeenCalledWith({
            userId: 'u1',
            topics: ['user-u1', 'global', 'game-g1']
        })
    })

    it('refuses more than four games', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({
            method: 'GET',
            url: '/token?game=g1&game=g2&game=g3&game=g4&game=g5'
        })
        expect(response.statusCode).toBe(400)
    })

    it('bounds token signing per account across games and client addresses', async () => {
        const { server, createTokenRequest } = await createServer()
        servers.push(server)
        for (let index = 0; index < 60; index += 1) {
            const response = await server.inject({
                method: 'GET',
                url: `/token?game=game-${index}`,
                remoteAddress: `203.0.113.${index + 1}`
            })
            expect(response.statusCode).toBe(200)
        }
        const exceeded = await server.inject({ method: 'GET', url: '/token' })
        expect(exceeded.statusCode).toBe(429)
        expect(Number(exceeded.headers['retry-after'])).toBeGreaterThan(0)
        expect(createTokenRequest).toHaveBeenCalledTimes(60)

        const other = await server.inject({
            method: 'GET',
            url: '/token',
            headers: { 'x-test-user': 'u2' }
        })
        expect(other.statusCode).toBe(200)
        expect(createTokenRequest).toHaveBeenCalledTimes(61)
    })
})
