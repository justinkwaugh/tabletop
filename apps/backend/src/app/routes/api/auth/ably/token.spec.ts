import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import tokenRoute from './token.js'

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
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = { ...user, roles }
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)
    const createTokenRequest = vi.fn(
        async ({ userId, topics }: { userId: string; topics: string[] }) => ({
            clientId: userId,
            capability: JSON.stringify(
                Object.fromEntries(topics.map((topic) => [topic, ['subscribe']]))
            )
        })
    )
    Reflect.set(server, 'ablyService', { createTokenRequest })
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
})
