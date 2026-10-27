import Fastify from 'fastify'
import SecureSession from '@fastify/secure-session'
import { afterEach, describe, expect, it } from 'vitest'
import { trustedProxyChain } from '../../runtime/clientAddress.js'
import RateLimitPlugin from './rateLimit.js'

const CLOUD_RUN_INGRESS = '169.254.169.126'
const HOSTING_PROXY = '66.249.80.9'
const DIRECT_CALLER = '198.51.100.7'

describe('request rate limiting', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function createServer(service: string) {
        const server = Fastify({ trustProxy: trustedProxyChain(service) })
        await server.register(RateLimitPlugin, { service })
        await server.register(SecureSession, {
            sessionName: 'session',
            cookieName: '__session',
            key: Buffer.alloc(32, 7)
        })
        server.addHook('onRequest', async (request) => {
            const userId = request.headers['x-test-user']
            if (typeof userId === 'string') request.session.set('userId', userId)
        })
        server.get(
            '/probe',
            { config: { rateLimit: { max: 2, timeWindow: '1 minute' } } },
            async () => ({ ok: true })
        )
        server.get('/unlimited', async () => ({ ok: true }))
        await server.ready()
        servers.add(server)
        return server
    }

    type Request = { forwardedFor?: string; fastlyClientIp?: string; userId?: string }

    async function probe(
        server: Awaited<ReturnType<typeof createServer>>,
        { forwardedFor, fastlyClientIp, userId }: Request,
        url = '/probe'
    ) {
        const headers: Record<string, string> = {}
        if (forwardedFor !== undefined) headers['x-forwarded-for'] = forwardedFor
        if (fastlyClientIp !== undefined) headers['fastly-client-ip'] = fastlyClientIp
        if (userId !== undefined) headers['x-test-user'] = userId
        return (await server.inject({ url, remoteAddress: '127.0.0.1', headers })).statusCode
    }

    async function statuses(
        server: Awaited<ReturnType<typeof createServer>>,
        requests: Request[],
        url?: string
    ) {
        const results: number[] = []
        for (const request of requests) results.push(await probe(server, request, url))
        return results
    }

    const direct = (fastlyClientIp?: string): Request => ({
        forwardedFor: `${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}`,
        fastlyClientIp
    })
    const viaHosting = (browser: string): Request => ({
        forwardedFor: `${browser}, ${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
        fastlyClientIp: browser
    })

    it('does not let a direct caller reset its quota by changing Fastly-Client-IP', async () => {
        const server = await createServer('backend')
        expect(
            await statuses(server, [
                direct('192.0.2.1'),
                direct('192.0.2.1'),
                direct('192.0.2.2'),
                direct('192.0.2.3'),
                direct()
            ])
        ).toEqual([200, 200, 429, 429, 429])
    })

    it('does not let a direct caller reset its quota by prepending forwarding entries', async () => {
        const server = await createServer('backend')
        const forged = (prefix: string): Request => ({
            forwardedFor: `${prefix}, ${HOSTING_PROXY}, ${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}`,
            fastlyClientIp: prefix
        })
        expect(
            await statuses(server, [forged('192.0.2.1'), forged('192.0.2.2'), forged('192.0.2.3')])
        ).toEqual([200, 200, 429])
    })

    it('gives each browser behind Firebase Hosting its own quota', async () => {
        const server = await createServer('backend')
        expect(
            await statuses(server, [
                viaHosting('203.0.113.1'),
                viaHosting('203.0.113.2'),
                viaHosting('203.0.113.1'),
                viaHosting('203.0.113.2'),
                viaHosting('203.0.113.1'),
                viaHosting('203.0.113.2')
            ])
        ).toEqual([200, 200, 200, 200, 429, 429])
    })

    it('keys an Authenticated Session by its Account rather than its address', async () => {
        const server = await createServer('backend')
        const browser = viaHosting('203.0.113.1')
        expect(
            await statuses(server, [
                browser,
                browser,
                browser,
                { ...browser, userId: 'user-1' },
                { ...browser, userId: 'user-1' },
                { ...browser, userId: 'user-1' },
                { ...browser, userId: 'user-2' }
            ])
        ).toEqual([200, 200, 429, 200, 200, 429, 200])
    })

    it('applies the anonymous default budget to every route on a hosted service', async () => {
        const server = await createServer('backend')
        const results = await statuses(
            server,
            Array.from({ length: 101 }, () => direct()),
            '/unlimited'
        )
        expect(results.slice(0, 100).every((status) => status === 200)).toBe(true)
        expect(results[100]).toBe(429)
    })

    it('leaves unconfigured routes unlimited on the local service', async () => {
        const server = await createServer('local')
        const results = await statuses(
            server,
            Array.from({ length: 101 }, () => ({ forwardedFor: DIRECT_CALLER })),
            '/unlimited'
        )
        expect(results.every((status) => status === 200)).toBe(true)
    })
})
