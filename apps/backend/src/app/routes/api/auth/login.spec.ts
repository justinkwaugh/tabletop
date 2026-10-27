import Fastify from 'fastify'
import SecureSession from '@fastify/secure-session'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { trustedProxyChain } from '../../../../runtime/clientAddress.js'
import RateLimitPlugin from '../../../plugins/rateLimit.js'
import loginRoute from './login.js'

const CLOUD_RUN_INGRESS = '169.254.169.126'
const HOSTING_PROXY = '66.249.80.9'

describe('POST /login', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function createServer() {
        const server = Fastify({ trustProxy: trustedProxyChain('backend') })
        await server.register(RateLimitPlugin, { service: 'backend' })
        await server.register(SecureSession, {
            sessionName: 'session',
            cookieName: '__session',
            key: Buffer.alloc(32, 7)
        })
        const getUserByUsernameAndPassword = vi.fn(async () => null)
        Reflect.set(server, 'userService', { getUserByUsernameAndPassword })
        await server.register(loginRoute)
        await server.ready()
        servers.add(server)
        return { server, getUserByUsernameAndPassword }
    }

    let nextAddress = 0
    async function attempt(server: ReturnType<typeof Fastify>, username: string) {
        nextAddress += 1
        const browser = `203.0.113.${nextAddress}`
        return server.inject({
            method: 'POST',
            url: '/login',
            remoteAddress: '127.0.0.1',
            headers: {
                'x-forwarded-for': `${browser}, ${HOSTING_PROXY}, ${CLOUD_RUN_INGRESS}`,
                'fastly-client-ip': browser
            },
            payload: { username, password: 'not the password' }
        })
    }

    it('bounds attempts against one Username across many addresses', async () => {
        const { server, getUserByUsernameAndPassword } = await createServer()
        for (let index = 0; index < 20; index += 1) {
            expect((await attempt(server, 'Victim')).statusCode).toBe(401)
        }
        const exceeded = await attempt(server, ' victim ')
        expect(exceeded.statusCode).toBe(429)
        expect(Number(exceeded.headers['retry-after'])).toBeGreaterThan(0)
        expect(getUserByUsernameAndPassword).toHaveBeenCalledTimes(20)
    })

    it('keeps other Usernames unaffected by an exhausted budget', async () => {
        const { server } = await createServer()
        for (let index = 0; index < 21; index += 1) await attempt(server, 'victim')
        expect((await attempt(server, 'someone-else')).statusCode).toBe(401)
    })
})
