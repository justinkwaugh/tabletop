import Fastify from 'fastify'
import SecureSession from '@fastify/secure-session'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { trustedProxyChain } from '../../../../../runtime/clientAddress.js'
import RateLimitPlugin from '../../../../plugins/rateLimit.js'
import sendPasswordResetRoute from './sendPasswordReset.js'

const CLOUD_RUN_INGRESS = '169.254.169.126'
const HOSTING_PROXY = '66.249.80.9'
const victim = { id: 'user-1', email: 'victim@example.test' }

describe('POST /sendPasswordReset', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function createServer() {
        const server = Fastify({ trustProxy: trustedProxyChain('backend') })
        await server.register(SecureSession, {
            sessionName: 'session',
            cookieName: '__session',
            key: Buffer.alloc(32, 7)
        })
        await server.register(RateLimitPlugin, { service: 'backend' })
        const sendPasswordResetEmail = vi.fn(async () => undefined)
        Reflect.set(server, 'userService', {
            getUserByEmail: async (email: string) =>
                email.trim().toLowerCase() === victim.email ? victim : undefined,
            sendPasswordResetEmail
        })
        await server.register(sendPasswordResetRoute)
        await server.ready()
        servers.add(server)
        return { server, sendPasswordResetEmail }
    }

    let nextAddress = 0
    async function request(server: ReturnType<typeof Fastify>, email: string) {
        nextAddress += 1
        const browser = `203.0.113.${nextAddress}`
        return server.inject({
            method: 'POST',
            url: '/sendPasswordReset',
            remoteAddress: '127.0.0.1',
            headers: {
                'x-forwarded-for': `${browser}, ${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
                'fastly-client-ip': browser
            },
            payload: { email }
        })
    }

    it('bounds reset emails for one address across many requesters', async () => {
        const { server, sendPasswordResetEmail } = await createServer()
        expect((await request(server, victim.email)).statusCode).toBe(200)
        expect((await request(server, 'Victim@Example.test')).statusCode).toBe(200)
        expect((await request(server, ` ${victim.email} `)).statusCode).toBe(200)
        for (let index = 3; index < 10; index += 1) {
            expect((await request(server, victim.email)).statusCode).toBe(200)
        }
        expect((await request(server, victim.email)).statusCode).toBe(429)
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(10)
    })

    it('keeps other addresses unaffected by an exhausted budget', async () => {
        const { server } = await createServer()
        for (let index = 0; index < 11; index += 1) await request(server, victim.email)
        expect((await request(server, 'other@example.test')).statusCode).toBe(200)
    })
})
