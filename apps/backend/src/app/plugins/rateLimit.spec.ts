import Fastify from 'fastify'
import SecureSession from '@fastify/secure-session'
import { afterEach, describe, expect, it } from 'vitest'
import { trustedProxyChain } from '../../runtime/clientAddress.js'
import RateLimitPlugin, { anonymousRequestsPerMinute, browsersPerHostingPeer } from './rateLimit.js'

const CLOUD_RUN_INGRESS = '169.254.169.126'
const HOSTING_PROXY = '66.249.80.9'
const OTHER_HOSTING_PROXY = '74.125.209.35'
const DIRECT_CALLER = '198.51.100.7'
const PROBE_MAX = 2

describe('request rate limiting', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function createServer(service: string) {
        const server = Fastify({ trustProxy: trustedProxyChain(service) })
        await server.register(SecureSession, {
            sessionName: 'session',
            cookieName: '__session',
            key: Buffer.alloc(32, 7)
        })
        server.addHook('onRequest', async (request) => {
            const userId = request.headers['x-test-user']
            if (typeof userId === 'string') request.session.set('userId', userId)
        })
        await server.register(RateLimitPlugin, { service })
        server.get(
            '/probe',
            { config: { rateLimit: { max: PROBE_MAX, timeWindow: '1 minute' } } },
            async () => ({ ok: true })
        )
        server.get('/unlimited', async () => ({ ok: true }))
        server.get('/exempt', { config: { rateLimit: false } }, async () => ({ ok: true }))
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
        return server.inject({ url, remoteAddress: '127.0.0.1', headers })
    }

    async function statuses(
        server: Awaited<ReturnType<typeof createServer>>,
        requests: Request[],
        url?: string
    ) {
        const results: number[] = []
        for (const request of requests) results.push((await probe(server, request, url)).statusCode)
        return results
    }

    const direct = (fastlyClientIp?: string): Request => ({
        forwardedFor: `${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}`,
        fastlyClientIp
    })
    const viaHosting = (browser: string, proxy = HOSTING_PROXY): Request => ({
        forwardedFor: `${browser}, ${proxy}, ${CLOUD_RUN_INGRESS}`,
        fastlyClientIp: browser
    })
    const rotatingHints = (count: number, proxy = HOSTING_PROXY) =>
        Array.from({ length: count }, (_, index) =>
            viaHosting(`203.0.${Math.floor(index / 250)}.${(index % 250) + 1}`, proxy)
        )

    describe.each([
        {
            path: 'direct',
            request: (address: string): Request => ({
                forwardedFor: `${address}, ${CLOUD_RUN_INGRESS}`
            })
        },
        { path: 'Hosting', request: viaHosting }
    ])('address normalization through $path', ({ request }) => {
        it('shares one allowance within an IPv6 /64 and keeps other subnets separate', async () => {
            const server = await createServer('backend')
            expect(
                await statuses(server, [
                    request('2001:db8:1:2::1'),
                    request('2001:db8:1:2::2'),
                    request('2001:0DB8:0001:0002:ffff::99'),
                    request('2001:db8:1:3::1')
                ])
            ).toEqual([200, 200, 429, 200])
        })

        it('shares one allowance between IPv4 and its IPv6-mapped form', async () => {
            const server = await createServer('backend')
            expect(
                await statuses(server, [
                    request('198.51.100.7'),
                    request('::ffff:198.51.100.7'),
                    request('::ffff:c633:6407'),
                    request('198.51.100.8')
                ])
            ).toEqual([200, 200, 429, 200])
        })
    })

    describe('direct callers of the Cloud Run URL', () => {
        it('cannot reset their quota by changing Fastly-Client-IP', async () => {
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

        it('cannot reset their quota by prepending forwarding entries', async () => {
            const server = await createServer('backend')
            const forged = (prefix: string): Request => ({
                forwardedFor: `${prefix}, ${HOSTING_PROXY}, ${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}`,
                fastlyClientIp: prefix
            })
            expect(
                await statuses(server, [
                    forged('192.0.2.1'),
                    forged('192.0.2.2'),
                    forged('192.0.2.3')
                ])
            ).toEqual([200, 200, 429])
        })
    })

    describe('callers arriving from a Google service address', () => {
        it('gives each forwarded browser its own quota', async () => {
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

        it('bounds rotating forwarded addresses by the ingress peer', async () => {
            const server = await createServer('backend')
            const peerMax = PROBE_MAX * browsersPerHostingPeer
            const results = await statuses(server, rotatingHints(peerMax + 3))
            expect(results).toEqual([
                ...Array.from({ length: peerMax }, () => 200),
                ...Array.from({ length: 3 }, () => 429)
            ])
        })

        it('answers an exhausted peer with Retry-After', async () => {
            const server = await createServer('backend')
            await statuses(server, rotatingHints(PROBE_MAX * browsersPerHostingPeer))
            const exceeded = await probe(server, viaHosting('203.0.113.99'))
            expect(exceeded.statusCode).toBe(429)
            expect(Number(exceeded.headers['retry-after'])).toBeGreaterThan(0)
            expect(exceeded.json()).toMatchObject({
                message: expect.stringContaining('requests through this Hosting address')
            })
        })

        it('keeps the peer bound separate for each Google service address', async () => {
            const server = await createServer('backend')
            const peerMax = PROBE_MAX * browsersPerHostingPeer
            await statuses(server, rotatingHints(peerMax))
            expect(await statuses(server, rotatingHints(2, OTHER_HOSTING_PROXY))).toEqual([
                200, 200
            ])
        })

        it('normalizes IPv6 peer spellings without grouping separate proxies', async () => {
            const server = await createServer('backend')
            const peerMax = PROBE_MAX * browsersPerHostingPeer
            await statuses(server, rotatingHints(peerMax, '2001:4860:4801:2::1'))
            expect(
                await statuses(server, [
                    viaHosting('203.0.113.99', '2001:4860:4801:0002:0000:0000:0000:0001'),
                    viaHosting('203.0.113.99', '2001:4860:4801:2::2')
                ])
            ).toEqual([429, 200])
        })

        it('keeps the peer bound separate for each route', async () => {
            const server = await createServer('backend')
            await statuses(server, rotatingHints(PROBE_MAX * browsersPerHostingPeer))
            expect(await statuses(server, rotatingHints(1), '/unlimited')).toEqual([200])
        })

        it('bounds unconfigured routes by the default budget per peer', async () => {
            const server = await createServer('backend')
            const peerMax = anonymousRequestsPerMinute * browsersPerHostingPeer
            const results = await statuses(server, rotatingHints(peerMax + 1), '/unlimited')
            expect(results.slice(0, peerMax).every((status) => status === 200)).toBe(true)
            expect(results[peerMax]).toBe(429)
        })

        it('does not count a route exempted from rate limiting', async () => {
            const server = await createServer('backend')
            const results = await statuses(
                server,
                rotatingHints(PROBE_MAX * browsersPerHostingPeer + 5),
                '/exempt'
            )
            expect(results.every((status) => status === 200)).toBe(true)
        })
    })

    it('keys an Authenticated Session by its Account rather than its address', async () => {
        const server = await createServer('backend')
        const browser = viaHosting('2001:db8:1:2::1')
        expect(
            await statuses(server, [
                browser,
                browser,
                browser,
                { ...browser, userId: 'user-1' },
                { ...viaHosting('2001:db8:1:2::2'), userId: 'user-1' },
                { ...viaHosting('2001:db8:1:3::1'), userId: 'user-1' },
                { ...browser, userId: 'user-2' }
            ])
        ).toEqual([200, 200, 429, 200, 200, 429, 200])
    })

    it('does not spend the peer bound on Authenticated Sessions', async () => {
        const server = await createServer('backend')
        const sessions = rotatingHints(PROBE_MAX * browsersPerHostingPeer).map(
            (request, index) => ({
                ...request,
                userId: `user-${index}`
            })
        )
        await statuses(server, sessions)
        expect(await statuses(server, rotatingHints(1))).toEqual([200])
    })

    it('applies the anonymous default budget to every route on a hosted service', async () => {
        const server = await createServer('backend')
        const results = await statuses(
            server,
            Array.from({ length: anonymousRequestsPerMinute + 1 }, () => direct()),
            '/unlimited'
        )
        expect(results.slice(0, anonymousRequestsPerMinute).every((status) => status === 200)).toBe(
            true
        )
        expect(results[anonymousRequestsPerMinute]).toBe(429)
    })

    it('leaves unconfigured routes unlimited on the local service', async () => {
        const server = await createServer('local')
        const results = await statuses(
            server,
            Array.from({ length: anonymousRequestsPerMinute + 1 }, () => ({
                forwardedFor: DIRECT_CALLER
            })),
            '/unlimited'
        )
        expect(results.every((status) => status === 200)).toBe(true)
    })

    it('keeps route budgets on the local service', async () => {
        const server = await createServer('local')
        expect(
            await statuses(server, [
                { forwardedFor: DIRECT_CALLER },
                { forwardedFor: DIRECT_CALLER },
                { forwardedFor: DIRECT_CALLER }
            ])
        ).toEqual([200, 200, 429])
    })
})
