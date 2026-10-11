import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it, vi } from 'vitest'
import finalScoresBackfillRoute from './finalScoresBackfill.js'

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
    const backfillFinalScores = vi.fn(async () => undefined)
    await server.register(sensible)
    Reflect.set(server, 'gameService', { backfillFinalScores })
    await server.register(finalScoresBackfillRoute)
    return { server, backfillFinalScores }
}

describe('internal final scores backfill task', () => {
    it('validates the payload and processes one page', async () => {
        const { server, backfillFinalScores } = await setup()
        for (const payload of [
            { runId: 'run', counts: {} },
            { runId: 'run', write: true, counts: { written: -1 } }
        ]) {
            expect(
                (await server.inject({ method: 'POST', url: '/finalScoresBackfill', payload }))
                    .statusCode
            ).toBe(400)
        }
        expect(backfillFinalScores).not.toHaveBeenCalled()
        const payload = { runId: 'run', write: true, afterGameId: 'g', counts: { written: 2 } }
        expect(
            (await server.inject({ method: 'POST', url: '/finalScoresBackfill', payload }))
                .statusCode
        ).toBe(200)
        expect(backfillFinalScores).toHaveBeenCalledWith(payload)
    })

    it('returns failure so the queue retries the page', async () => {
        const { server, backfillFinalScores } = await setup()
        backfillFinalScores.mockRejectedValueOnce(new Error('Storage unavailable'))
        const request = {
            method: 'POST',
            url: '/finalScoresBackfill',
            payload: { runId: 'run', write: false, counts: {} }
        } as const
        expect((await server.inject(request)).statusCode).toBe(500)
        expect((await server.inject(request)).statusCode).toBe(200)
    })
})
