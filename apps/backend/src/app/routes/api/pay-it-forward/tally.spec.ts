import { Charity, type CharityTally } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import tallyRoute from './tally.js'

const tally: CharityTally = {
    totalUsd: 12.5,
    charities: [
        { charity: Charity.GamersOutreach, amount: 12.5, currency: 'USD', campaignOpen: true }
    ]
}

async function createServer(withService: boolean) {
    const server = Fastify()
    const getTally = vi.fn(async () => tally)
    Reflect.set(server, 'charityTallyService', withService ? { getTally } : undefined)
    await server.register(tallyRoute)
    return server
}

describe('GET /tally', () => {
    const servers: ReturnType<typeof Fastify>[] = []

    afterEach(async () => {
        await Promise.all(servers.map((server) => server.close()))
        servers.length = 0
    })

    it('returns the tally for anyone, cacheable by browsers', async () => {
        const server = await createServer(true)
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/tally' })
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('public, max-age=600')
        expect(response.json()).toEqual({ status: 'ok', payload: tally })
    })

    it('is not found when Tiltify is not configured', async () => {
        const server = await createServer(false)
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/tally' })
        expect(response.statusCode).toBe(404)
    })
})
