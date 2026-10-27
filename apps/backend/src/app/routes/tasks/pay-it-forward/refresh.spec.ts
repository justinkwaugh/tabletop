import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import refreshRoute from './refresh.js'

async function createServer(refresh: (() => Promise<unknown>) | undefined) {
    const server = Fastify()
    Reflect.set(server, 'charityTallyRefresher', refresh ? { refresh } : undefined)
    await server.register(refreshRoute)
    return server
}

describe('POST /refresh', () => {
    const servers: ReturnType<typeof Fastify>[] = []

    afterEach(async () => {
        await Promise.all(servers.map((server) => server.close()))
        servers.length = 0
    })

    it('refreshes the tally', async () => {
        const refresh = vi.fn(async () => ({ totalUsd: 0, charities: [] }))
        const server = await createServer(refresh)
        servers.push(server)
        const response = await server.inject({ method: 'POST', url: '/refresh' })
        expect(response.statusCode).toBe(200)
        expect(refresh).toHaveBeenCalledOnce()
    })

    it('fails so the scheduler records it when a source is down', async () => {
        const server = await createServer(async () => {
            throw new Error('Tiltify GET failed with 503')
        })
        servers.push(server)
        const response = await server.inject({ method: 'POST', url: '/refresh' })
        expect(response.statusCode).toBe(500)
    })

    it('is not found on a service without the Tiltify credentials', async () => {
        const server = await createServer(undefined)
        servers.push(server)
        const response = await server.inject({ method: 'POST', url: '/refresh' })
        expect(response.statusCode).toBe(404)
    })
})
