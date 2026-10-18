import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import reportRoute from './report.js'
import rollupRoute from './rollup.js'

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup(isAdmin = true) {
    const server = Fastify()
    servers.push(server)
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async () => undefined)
    Reflect.set(server, 'verifyRoleAdmin', async () => {
        if (!isAdmin) throw new Error('Administrator required')
    })
    const siteStatsService = {
        getReport: vi.fn(async () => ({ current: {}, previous: {} })),
        startRollup: vi.fn(async () => 'run-1')
    }
    Reflect.set(server, 'siteStatsService', siteStatsService)
    await server.register(reportRoute)
    await server.register(rollupRoute)
    return { server, siteStatsService }
}

describe('admin site stats report', () => {
    it('reports a range of UTC days', async () => {
        const { server, siteStatsService } = await setup()
        const response = await server.inject('/report?from=2026-09-20&to=2026-10-17')
        expect(response.statusCode).toBe(200)
        expect(siteStatsService.getReport).toHaveBeenCalledWith({
            from: '2026-09-20',
            to: '2026-10-17'
        })
    })

    it('refuses days that are not dates', async () => {
        const { server, siteStatsService } = await setup()
        expect((await server.inject('/report?from=yesterday&to=2026-10-17')).statusCode).toBe(400)
        expect(siteStatsService.getReport).not.toHaveBeenCalled()
    })

    it('refuses a user who is not an Administrator', async () => {
        const { server, siteStatsService } = await setup(false)
        const response = await server.inject('/report?from=2026-10-01&to=2026-10-17')
        expect(response.statusCode).toBeGreaterThanOrEqual(400)
        expect(siteStatsService.getReport).not.toHaveBeenCalled()
    })
})

describe('admin site stats rollup', () => {
    it('passes the requested days on and returns the run', async () => {
        const { server, siteStatsService } = await setup()
        const response = await server.inject({ method: 'POST', url: '/rollup', payload: {} })
        expect(response.json().payload).toEqual({ runId: 'run-1' })
        expect(siteStatsService.startRollup).toHaveBeenCalledWith({})
    })

    it('passes a chosen range on', async () => {
        const { server, siteStatsService } = await setup()
        await server.inject({
            method: 'POST',
            url: '/rollup',
            payload: { from: '2026-10-01', to: '2026-10-17' }
        })
        expect(siteStatsService.startRollup).toHaveBeenCalledWith({
            from: '2026-10-01',
            to: '2026-10-17'
        })
    })
})
