import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import dailyRoute from './daily.js'
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
        yesterday: () => '2026-10-17',
        getRange: vi.fn(async (from: string, to: string) => ({ from, to })),
        startRollup: vi.fn(async () => 'run-1')
    }
    Reflect.set(server, 'siteStatsService', siteStatsService)
    await server.register(dailyRoute)
    await server.register(rollupRoute)
    return { server, siteStatsService }
}

describe('admin site stats range', () => {
    it('serves a range of UTC days', async () => {
        const { server, siteStatsService } = await setup()
        const response = await server.inject('/daily?from=2026-09-20&to=2026-10-17')
        expect(response.statusCode).toBe(200)
        expect(siteStatsService.getRange).toHaveBeenCalledWith('2026-09-20', '2026-10-17')
    })

    it.each([
        ['backwards', 'from=2026-10-17&to=2026-10-01'],
        ['impossible', 'from=2026-02-30&to=2026-03-01'],
        ['too long', 'from=2024-01-01&to=2026-10-17'],
        ['malformed', 'from=yesterday&to=2026-10-17']
    ])('refuses a %s range', async (_, query) => {
        const { server, siteStatsService } = await setup()
        expect((await server.inject(`/daily?${query}`)).statusCode).toBe(400)
        expect(siteStatsService.getRange).not.toHaveBeenCalled()
    })

    it('refuses a user who is not an Administrator', async () => {
        const { server, siteStatsService } = await setup(false)
        const response = await server.inject('/daily?from=2026-10-01&to=2026-10-17')
        expect(response.statusCode).toBeGreaterThanOrEqual(400)
        expect(siteStatsService.getRange).not.toHaveBeenCalled()
    })
})

describe('admin site stats rollup', () => {
    it('defaults to every day through yesterday', async () => {
        const { server, siteStatsService } = await setup()
        const response = await server.inject({ method: 'POST', url: '/rollup', payload: {} })
        expect(response.json().payload).toEqual({ runId: 'run-1' })
        expect(siteStatsService.startRollup).toHaveBeenCalledWith(undefined, '2026-10-17')
    })

    it('refuses to roll up today', async () => {
        const { server, siteStatsService } = await setup()
        const response = await server.inject({
            method: 'POST',
            url: '/rollup',
            payload: { from: '2026-10-01', through: '2026-10-18' }
        })
        expect(response.statusCode).toBe(400)
        expect(siteStatsService.startRollup).not.toHaveBeenCalled()
    })
})
