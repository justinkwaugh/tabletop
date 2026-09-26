import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it, vi } from 'vitest'
import autoStartRoute from './autoStart.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup() {
    const server = Fastify()
    servers.push(server)
    const autoStartGame = vi.fn(async () => undefined)
    await server.register(sensible)
    Reflect.set(server, 'gameService', { autoStartGame })
    await server.register(autoStartRoute)
    return { server, autoStartGame }
}

describe('internal game auto-start task', () => {
    it('validates the payload and starts the game', async () => {
        const { server, autoStartGame } = await setup()
        expect(
            (await server.inject({ method: 'POST', url: '/autoStart', payload: { gameId: 'g' } }))
                .statusCode
        ).toBe(400)
        expect(autoStartGame).not.toHaveBeenCalled()
        const payload = { gameId: 'g', autoStartAt: 1_000 }
        expect(
            (await server.inject({ method: 'POST', url: '/autoStart', payload })).statusCode
        ).toBe(200)
        expect(autoStartGame).toHaveBeenCalledWith(payload)
    })

    it('returns failure so the queue retries the task', async () => {
        const { server, autoStartGame } = await setup()
        autoStartGame.mockRejectedValueOnce(new Error('Start failed'))
        const request = {
            method: 'POST',
            url: '/autoStart',
            payload: { gameId: 'g', autoStartAt: 1_000 }
        } as const
        expect((await server.inject(request)).statusCode).toBe(500)
        expect((await server.inject(request)).statusCode).toBe(200)
    })
})
