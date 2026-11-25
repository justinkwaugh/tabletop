import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import lobbyPostsRoute from './lobbyPosts.js'

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup({ isAdmin, enabled }: { isAdmin: boolean; enabled: boolean }) {
    const server = Fastify()
    servers.push(server)
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async () => undefined)
    Reflect.set(server, 'verifyRoleAdmin', async () => {
        if (!isAdmin) throw new Error('Administrator required')
    })
    const queueOpenGames = vi.fn(async () => ['g-1', 'g-2'])
    Reflect.set(server, 'lobbyPosts', enabled ? { queueOpenGames } : undefined)
    await server.register(lobbyPostsRoute)
    return { server, queueOpenGames }
}

const request = { method: 'POST', url: '/lobbyPosts' } as const

describe('admin lobby posts request', () => {
    it('queues the open games and returns their ids', async () => {
        const { server, queueOpenGames } = await setup({ isAdmin: true, enabled: true })
        const response = await server.inject(request)
        expect(response.statusCode).toBe(200)
        expect(response.json().payload).toEqual({ gameIds: ['g-1', 'g-2'] })
        expect(queueOpenGames).toHaveBeenCalledOnce()
    })

    it('answers 503 when lobby posts are off', async () => {
        const { server } = await setup({ isAdmin: true, enabled: false })
        expect((await server.inject(request)).statusCode).toBe(503)
    })

    it('refuses a user who is not an Administrator', async () => {
        const { server, queueOpenGames } = await setup({ isAdmin: false, enabled: true })
        expect((await server.inject(request)).statusCode).toBeGreaterThanOrEqual(400)
        expect(queueOpenGames).not.toHaveBeenCalled()
    })
})
