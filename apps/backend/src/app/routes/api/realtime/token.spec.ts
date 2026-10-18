import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import tokenRoute from './token.js'

vi.mock('@tabletop/backend-services', () => ({
    GLOBAL_TOPIC: 'global',
    userTopic: (userId: string) => `user-${userId}`,
    gameTopic: (gameId: string) => `game-${gameId}`
}))

const user: User = {
    id: 'u1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer({ withIssuer = true }: { withIssuer?: boolean } = {}) {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)
    const issue = vi.fn(({ topics }: { userId: string; topics: string[] }) => topics.join(','))
    Reflect.set(server, 'realtimeTokenIssuer', withIssuer ? { issue } : undefined)
    await server.register(tokenRoute)
    return { server, issue }
}

describe('GET /token', () => {
    const servers: ReturnType<typeof Fastify>[] = []

    afterEach(async () => {
        await Promise.all(servers.map((server) => server.close()))
        servers.length = 0
    })

    it('grants the user and global topics', async () => {
        const { server, issue } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token' })
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.json()).toEqual({ status: 'ok', payload: { token: 'user-u1,global' } })
        expect(issue).toHaveBeenCalledWith({ userId: 'u1', topics: ['user-u1', 'global'] })
    })

    it('adds the game topic for a game that exists', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?game=g1' })
        expect(response.json().payload.token).toBe('user-u1,global,game-g1')
    })

    it('adds a topic for each requested game', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?game=g1&game=g2' })
        expect(response.json().payload.token).toBe('user-u1,global,game-g1,game-g2')
    })

    it('grants a game topic without looking the game up', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?game=g1&game=g1' })
        expect(response.json().payload.token).toBe('user-u1,global,game-g1')
    })

    it('is absent when the relay is not configured', async () => {
        const { server } = await createServer({ withIssuer: false })
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token' })
        expect(response.statusCode).toBe(404)
    })
})
