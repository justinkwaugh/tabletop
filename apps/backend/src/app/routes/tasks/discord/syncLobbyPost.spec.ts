import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it, vi } from 'vitest'
import syncLobbyPostRoute from './syncLobbyPost.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup(
    lobbyPosts: { sync: (task: { gameId: string; quiet?: true }) => Promise<void> } | undefined
) {
    const server = Fastify()
    servers.push(server)
    await server.register(sensible)
    Reflect.set(server, 'lobbyPosts', lobbyPosts)
    await server.register(syncLobbyPostRoute)
    return server
}

const request = { method: 'POST', url: '/syncLobbyPost', payload: { gameId: 'g' } } as const

describe('lobby post sync task', () => {
    it('validates the payload and syncs the game', async () => {
        const sync = vi.fn(async () => undefined)
        const server = await setup({ sync })

        expect((await server.inject({ ...request, payload: {} })).statusCode).toBe(400)
        expect((await server.inject(request)).statusCode).toBe(200)
        expect(sync).toHaveBeenCalledWith({ gameId: 'g' })
        expect(
            (await server.inject({ ...request, payload: { gameId: 'g', quiet: true } })).statusCode
        ).toBe(200)
        expect(sync).toHaveBeenLastCalledWith({ gameId: 'g', quiet: true })
    })

    it('returns failure so the queue retries the task', async () => {
        const sync = vi.fn(async () => undefined).mockRejectedValueOnce(new Error('Discord down'))
        const server = await setup({ sync })

        expect((await server.inject(request)).statusCode).toBe(500)
        expect((await server.inject(request)).statusCode).toBe(200)
    })

    it('refuses the task, so the queue retries, when lobby posts are off', async () => {
        const server = await setup(undefined)

        expect((await server.inject(request)).statusCode).toBe(503)
    })
})
