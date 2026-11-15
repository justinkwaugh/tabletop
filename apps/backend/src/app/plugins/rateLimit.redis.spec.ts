import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import Fastify from 'fastify'
import SecureSession from '@fastify/secure-session'
import { createClient, type RedisClientType } from 'redis'
import { RedisRateLimitCounter } from '@tabletop/backend-services/rate-limit-counter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trustedProxyChain } from '../../runtime/clientAddress.js'
import loginRoute from '../routes/api/auth/login.js'
import RateLimitPlugin, { browsersPerHostingPeer } from './rateLimit.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

const CLOUD_RUN_INGRESS = '169.254.169.126'
const HOSTING_PROXY = '66.249.80.9'
const DIRECT_CALLER = '198.51.100.7'
const PROBE_MAX = 2
const BURST_MAX = 10

function connect(disableOfflineQueue = false): RedisClientType {
    return createClient({
        disableOfflineQueue,
        socket: {
            host: process.env.CACHE_TEST_REDIS_HOST,
            port: Number(process.env.CACHE_TEST_REDIS_PORT ?? 6379),
            reconnectStrategy: false
        }
    })
}

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST)('request budgets shared through Redis', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()
    const clients = new Set<RedisClientType>()
    let keyScope: string
    let admin: RedisClientType

    beforeEach(async () => {
        keyScope = `rate-limit-test:${randomUUID()}:`
        admin = connect()
        await admin.connect()
    })

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
        const keys: string[] = []
        for await (const batch of admin.scanIterator({ MATCH: `${keyScope}*` })) keys.push(...batch)
        if (keys.length) await admin.del(keys)
        for (const client of clients) client.destroy()
        clients.clear()
        admin.destroy()
    })

    async function createInstance(client?: RedisClientType) {
        const redis = client ?? connect()
        if (!client) {
            await redis.connect()
            clients.add(redis)
        }
        const server = Fastify({ trustProxy: trustedProxyChain('backend') })
        await server.register(SecureSession, {
            sessionName: 'session',
            cookieName: '__session',
            key: Buffer.alloc(32, 7)
        })
        await server.register(RateLimitPlugin, {
            service: 'backend',
            counter: new RedisRateLimitCounter(redis),
            keyScope
        })
        server.get(
            '/probe',
            { config: { rateLimit: { max: PROBE_MAX, timeWindow: '1 minute' } } },
            async () => ({ ok: true })
        )
        server.get(
            '/burst',
            { config: { rateLimit: { max: BURST_MAX, timeWindow: '1 minute' } } },
            async () => ({ ok: true })
        )
        Reflect.set(server, 'userService', {
            getUserByUsernameAndPassword: vi.fn(async () => null)
        })
        await server.register(loginRoute)
        await server.ready()
        servers.add(server)
        return server
    }

    type Instance = Awaited<ReturnType<typeof createInstance>>

    const direct = (url = '/probe') => ({
        url,
        remoteAddress: '127.0.0.1',
        headers: { 'x-forwarded-for': `${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}` }
    })
    const viaHosting = (browser: string, url = '/probe') => ({
        url,
        remoteAddress: '127.0.0.1',
        headers: {
            'x-forwarded-for': `${browser}, ${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
            'fastly-client-ip': browser
        }
    })
    const login = (username: string) => ({
        method: 'POST' as const,
        url: '/login',
        remoteAddress: '127.0.0.1',
        headers: { 'x-forwarded-for': `${DIRECT_CALLER}, ${CLOUD_RUN_INGRESS}` },
        payload: { username, password: 'not the password' }
    })

    async function status(server: Instance, request: ReturnType<typeof direct>) {
        return (await server.inject(request)).statusCode
    }

    it('continues one client budget on a second instance', async () => {
        const first = await createInstance()
        const second = await createInstance()
        expect(await status(first, direct())).toBe(200)
        expect(await status(first, direct())).toBe(200)
        expect(await status(second, direct())).toBe(429)
        expect(await status(first, direct())).toBe(429)
    })

    it('continues an operation budget on a second instance', async () => {
        const first = await createInstance()
        const second = await createInstance()
        for (let index = 0; index < 20; index += 1) {
            expect(await status(index % 2 ? second : first, login('victim'))).toBe(401)
        }
        expect(await status(second, login('Victim'))).toBe(429)
        expect(await status(first, login('victim'))).toBe(429)
        expect(await status(first, login('someone-else'))).toBe(401)
    })

    it('continues the Hosting peer bound on a second instance', async () => {
        const first = await createInstance()
        const second = await createInstance()
        const peerMax = PROBE_MAX * browsersPerHostingPeer
        for (let index = 0; index < peerMax; index += 1) {
            expect(
                await status(index % 2 ? second : first, viaHosting(`203.0.113.${index + 1}`))
            ).toBe(200)
        }
        expect(await status(first, viaHosting('203.0.113.200'))).toBe(429)
        expect(await status(second, viaHosting('203.0.113.201'))).toBe(429)
    })

    it('admits exactly the budget under concurrent requests across instances', async () => {
        const first = await createInstance()
        const second = await createInstance()
        const results = await Promise.all(
            Array.from({ length: 40 }, (_, index) =>
                status(index % 2 ? second : first, direct('/burst'))
            )
        )
        expect(results.filter((code) => code === 200)).toHaveLength(BURST_MAX)
        expect(results.filter((code) => code === 429)).toHaveLength(40 - BURST_MAX)
    })

    it('reopens the budget when the window expires', async () => {
        const server = await createInstance()
        expect(await status(server, direct())).toBe(200)
        expect(await status(server, direct())).toBe(200)
        expect(await status(server, direct())).toBe(429)
        const keys: string[] = []
        for await (const batch of admin.scanIterator({ MATCH: `${keyScope}*` })) keys.push(...batch)
        expect(keys).toEqual([`${keyScope}GET:/probe:client:${DIRECT_CALLER}`])
        await admin.pExpire(keys[0], 1)
        await delay(10)
        expect(await status(server, direct())).toBe(200)
    })

    it('falls back to per-instance budgets while Redis is unreachable', async () => {
        const offline = connect(true)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        try {
            const first = await createInstance(offline)
            const second = await createInstance(offline)
            expect(await status(first, direct())).toBe(200)
            expect(await status(first, direct())).toBe(200)
            expect(await status(first, direct())).toBe(429)
            expect(await status(second, direct())).toBe(200)
            expect(warn).toHaveBeenCalled()
        } finally {
            warn.mockRestore()
        }
    })
})
