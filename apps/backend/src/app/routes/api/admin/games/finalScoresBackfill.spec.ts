import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import finalScoresBackfillRoute from './finalScoresBackfill.js'

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup(isAdmin: boolean) {
    const server = Fastify()
    servers.push(server)
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async () => undefined)
    Reflect.set(server, 'verifyRoleAdmin', async () => {
        if (!isAdmin) throw new Error('Administrator required')
    })
    const startFinalScoresBackfill = vi.fn(async () => 'run-1')
    Reflect.set(server, 'gameService', { startFinalScoresBackfill })
    await server.register(finalScoresBackfillRoute)
    return { server, startFinalScoresBackfill }
}

describe('admin final scores backfill request', () => {
    it.each([false, true])('starts a run with write: %s and returns its id', async (write) => {
        const { server, startFinalScoresBackfill } = await setup(true)
        const response = await server.inject({
            method: 'POST',
            url: '/finalScoresBackfill',
            payload: { write }
        })
        expect(response.statusCode).toBe(200)
        expect(response.json().payload).toEqual({ runId: 'run-1' })
        expect(startFinalScoresBackfill).toHaveBeenCalledWith(write)
    })

    it('requires an explicit write choice', async () => {
        const { server, startFinalScoresBackfill } = await setup(true)
        expect(
            (await server.inject({ method: 'POST', url: '/finalScoresBackfill', payload: {} }))
                .statusCode
        ).toBe(400)
        expect(startFinalScoresBackfill).not.toHaveBeenCalled()
    })

    it('refuses a user who is not an Administrator', async () => {
        const { server, startFinalScoresBackfill } = await setup(false)
        const response = await server.inject({
            method: 'POST',
            url: '/finalScoresBackfill',
            payload: { write: false }
        })
        expect(response.statusCode).toBeGreaterThanOrEqual(400)
        expect(startFinalScoresBackfill).not.toHaveBeenCalled()
    })
})
