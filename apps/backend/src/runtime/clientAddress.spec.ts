import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clientIdentity, trustedProxyChain } from './clientAddress.js'

const CLOUD_RUN_INGRESS = '169.254.169.126'
const HOSTING_PROXY = '74.125.209.35'
const HOSTING_PROXY_V6 = '2001:4860:4801:2::1'
const BROWSER = '203.0.113.10'
const DIRECT_CALLER = '198.51.100.7'

describe('client address derivation', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()
    const warn = vi.fn()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
        warn.mockClear()
    })

    async function createServer(service: string) {
        const noop = () => undefined
        const loggerInstance = {
            level: 'warn',
            fatal: noop,
            error: noop,
            warn,
            info: noop,
            debug: noop,
            trace: noop,
            silent: noop,
            child() {
                return loggerInstance
            }
        }
        const server = Fastify({ trustProxy: trustedProxyChain(service), loggerInstance })
        server.get('/whoami', async (request) => clientIdentity(request))
        await server.ready()
        servers.add(server)
        return server
    }

    async function whoami(
        server: Awaited<ReturnType<typeof createServer>>,
        {
            socketPeer = '127.0.0.1',
            forwardedFor,
            fastlyClientIp
        }: { socketPeer?: string; forwardedFor?: string; fastlyClientIp?: string }
    ) {
        const headers: Record<string, string> = {}
        if (forwardedFor !== undefined) headers['x-forwarded-for'] = forwardedFor
        if (fastlyClientIp !== undefined) headers['fastly-client-ip'] = fastlyClientIp
        const response = await server.inject({ url: '/whoami', remoteAddress: socketPeer, headers })
        expect(response.statusCode).toBe(200)
        return response.json<{ ingressPeer: string; client: string; attribution: string }>()
    }

    describe('behind Cloud Run', () => {
        it('attributes traffic from a Google service address to the forwarded hint', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${BROWSER}, ${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
                fastlyClientIp: BROWSER
            })
            expect(result).toEqual({
                ingressPeer: HOSTING_PROXY,
                client: BROWSER,
                attribution: 'hosting-hint'
            })
            expect(warn).not.toHaveBeenCalled()
        })

        it('ignores forwarding entries a browser added before Hosting saw the request', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `1.1.1.1, 2.2.2.2, ${BROWSER}, ${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
                fastlyClientIp: BROWSER
            })
            expect(result.client).toBe(BROWSER)
        })

        it('keys a direct caller by the address Cloud Run appended, not a forged header', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}`,
                fastlyClientIp: BROWSER
            })
            expect(result).toEqual({
                ingressPeer: DIRECT_CALLER,
                client: DIRECT_CALLER,
                attribution: 'ingress-peer'
            })
            expect(warn).toHaveBeenCalledWith(
                { ingressPeer: DIRECT_CALLER, claimed: BROWSER },
                expect.stringContaining('Ignoring Fastly-Client-IP')
            )
        })

        it('ignores a direct caller impersonating the Hosting hop inside X-Forwarded-For', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${BROWSER}, ${HOSTING_PROXY}, ${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}`,
                fastlyClientIp: BROWSER
            })
            expect(result.client).toBe(DIRECT_CALLER)
        })

        it('keys a direct caller by its own address when it sends no claim', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}`
            })
            expect(result).toEqual({
                ingressPeer: DIRECT_CALLER,
                client: DIRECT_CALLER,
                attribution: 'ingress-peer'
            })
            expect(warn).not.toHaveBeenCalled()
        })

        it('keys a Google service peer by itself when it sent no client address', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`
            })
            expect(result).toEqual({
                ingressPeer: HOSTING_PROXY,
                client: HOSTING_PROXY,
                attribution: 'ingress-peer'
            })
        })

        it('rejects a claim that is not an address', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
                fastlyClientIp: 'not-an-address'
            })
            expect(result.client).toBe(HOSTING_PROXY)
            expect(warn).toHaveBeenCalledOnce()
        })

        it('recognises an IPv6 Google service address', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${BROWSER}, ${HOSTING_PROXY_V6}, ${CLOUD_RUN_INGRESS}`,
                fastlyClientIp: BROWSER
            })
            expect(result.client).toBe(BROWSER)
        })

        it('treats a gateway peer outside the Cloud Run ingress range as the client', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                forwardedFor: `${BROWSER}, 10.0.0.9`,
                fastlyClientIp: BROWSER
            })
            expect(result).toEqual({
                ingressPeer: '10.0.0.9',
                client: '10.0.0.9',
                attribution: 'ingress-peer'
            })
        })

        it('keys the supervisor health probe by the loopback socket', async () => {
            const server = await createServer('backend')
            expect(await whoami(server, {})).toEqual({
                ingressPeer: '127.0.0.1',
                client: '127.0.0.1',
                attribution: 'ingress-peer'
            })
        })

        it('does not trust a non-loopback socket peer at all', async () => {
            const server = await createServer('backend')
            const result = await whoami(server, {
                socketPeer: DIRECT_CALLER,
                forwardedFor: `${BROWSER}, ${CLOUD_RUN_INGRESS}`
            })
            expect(result.ingressPeer).toBe(DIRECT_CALLER)
        })
    })

    describe('local service', () => {
        it('keys a direct local client by the address the gateway saw', async () => {
            const server = await createServer('local')
            const result = await whoami(server, { forwardedFor: BROWSER })
            expect(result).toEqual({
                ingressPeer: BROWSER,
                client: BROWSER,
                attribution: 'ingress-peer'
            })
        })

        it('ignores a forged Hosting header on a direct local request', async () => {
            const server = await createServer('local')
            const result = await whoami(server, {
                forwardedFor: BROWSER,
                fastlyClientIp: DIRECT_CALLER
            })
            expect(result.client).toBe(BROWSER)
        })

        it('does not walk past the gateway peer locally', async () => {
            const server = await createServer('local')
            const result = await whoami(server, { forwardedFor: `forged, 127.0.0.1` })
            expect(result.ingressPeer).toBe('127.0.0.1')
        })
    })
})
