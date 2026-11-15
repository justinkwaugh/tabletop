import { Charity, type CharityTally } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import tallyRoute from './tally.js'

const tally: CharityTally = {
    totalUsd: 12.5,
    charities: [
        { charity: Charity.GamersOutreach, amount: 12.5, currency: 'USD', campaignOpen: true }
    ]
}

async function createServer(stored: CharityTally | undefined) {
    const server = Fastify()
    Reflect.set(server, 'charityTallyService', { getTally: async () => stored })
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
        const server = await createServer(tally)
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/tally' })
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('public, max-age=600')
        expect(response.json()).toEqual({ status: 'ok', payload: tally })
    })

    it('is not found before the first refresh, and never cached', async () => {
        const server = await createServer(undefined)
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/tally' })
        expect(response.statusCode).toBe(404)
        expect(response.headers['cache-control']).toBe('no-store')
    })
})
