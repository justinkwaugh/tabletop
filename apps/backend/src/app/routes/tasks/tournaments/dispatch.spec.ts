import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it, vi } from 'vitest'
import dispatchRoute from './dispatch.js'

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
    const runTask = vi.fn(async () => undefined)
    await server.register(sensible)
    Reflect.set(server, 'tournamentService', { runTask })
    await server.register(dispatchRoute)
    return { server, runTask }
}

describe('internal tournament tasks', () => {
    it('validates task payloads and runs without request credentials', async () => {
        const { server, runTask } = await setup()
        expect(
            (await server.inject({ method: 'POST', url: '/dispatch', payload: {} })).statusCode
        ).toBe(400)
        expect(runTask).not.toHaveBeenCalled()
        const payload = { tournamentId: 'event', startId: 'pending-start' }
        expect(
            (await server.inject({ method: 'POST', url: '/dispatch', payload })).statusCode
        ).toBe(200)
        expect(runTask).toHaveBeenCalledWith(payload)
    })
    it('returns failure so the queue can retry the original task', async () => {
        const { server, runTask } = await setup()
        runTask.mockRejectedValueOnce(new Error('Game creation failed'))
        const request = {
            method: 'POST',
            url: '/dispatch',
            payload: { tournamentId: 'event' }
        } as const
        expect((await server.inject(request)).statusCode).toBe(500)
        expect((await server.inject(request)).statusCode).toBe(200)
        expect(runTask).toHaveBeenCalledTimes(2)
    })
    it('does not expose a reconciliation endpoint', async () => {
        const { server } = await setup()
        expect((await server.inject({ method: 'POST', url: '/reconcile' })).statusCode).toBe(404)
    })
})
