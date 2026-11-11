import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it, vi } from 'vitest'
import seriesBackfillRoute from './seriesBackfill.js'

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
    const backfillSeries = vi.fn(async () => undefined)
    await server.register(sensible)
    Reflect.set(server, 'gameService', { backfillSeries })
    await server.register(seriesBackfillRoute)
    return { server, backfillSeries }
}

describe('internal series backfill task', () => {
    it('validates the payload and processes one page', async () => {
        const { server, backfillSeries } = await setup()
        for (const payload of [
            { runId: 'run', titleIds: [], counts: {} },
            { runId: 'run', write: true, titleIds: [], counts: { written: -1 } }
        ]) {
            expect(
                (await server.inject({ method: 'POST', url: '/seriesBackfill', payload }))
                    .statusCode
            ).toBe(400)
        }
        expect(backfillSeries).not.toHaveBeenCalled()
        const payload = {
            runId: 'run',
            write: true,
            titleIds: ['1830'],
            afterGameId: 'g',
            counts: { written: 2 }
        }
        expect(
            (await server.inject({ method: 'POST', url: '/seriesBackfill', payload })).statusCode
        ).toBe(200)
        expect(backfillSeries).toHaveBeenCalledWith(payload)
    })

    it('returns failure so the queue retries the page', async () => {
        const { server, backfillSeries } = await setup()
        backfillSeries.mockRejectedValueOnce(new Error('Storage unavailable'))
        const request = {
            method: 'POST',
            url: '/seriesBackfill',
            payload: { runId: 'run', write: false, titleIds: [], counts: {} }
        } as const
        expect((await server.inject(request)).statusCode).toBe(500)
        expect((await server.inject(request)).statusCode).toBe(200)
    })
})
