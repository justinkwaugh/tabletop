import { assertExists, Role, UserStatus, type User } from '@tabletop/common'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

import authorization from '../../../plugins/authorization.js'
import { authSession } from '../../../lib/session.js'
import { sessionCookieHeader, sessionServer } from '../../../tests/sessionFixture.js'
import resendEmailVerification from './resendEmailVerification.js'
import sendEmailAuthVerification from './sendEmailAuthVerification.js'

describe.each([
    { url: '/resendEmailVerification', status: UserStatus.Incomplete },
    { url: '/sendEmailAuthVerification', status: UserStatus.Active }
])('account email budget for $url', ({ url, status }) => {
    const servers = new Set<FastifyInstance>()
    let now: number

    beforeEach(() => {
        now = Date.now()
        vi.spyOn(Date, 'now').mockImplementation(() => now)
    })

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
        vi.restoreAllMocks()
    })

    async function createServer() {
        const server = await sessionServer()
        servers.add(server)
        const users = new Map<string, User>(
            ['account-1', 'account-2'].map((id) => [
                id,
                { id, status, roles: [Role.User], externalIds: [] }
            ])
        )
        const sendEmail = vi.fn(async () => undefined)
        server.decorate('userService', {
            getUser: async (id: string) => users.get(id),
            sendVerificationEmail: sendEmail,
            sendEmailAuthVerification: sendEmail
        })
        await server.register(authorization)
        await server.register(resendEmailVerification)
        await server.register(sendEmailAuthVerification)
        server.post<{ Body: Pick<User, 'id'> }>('/session', async (request) => {
            const user = users.get(request.body.id)
            assertExists(user, 'The fixture account must exist')
            await authSession({
                session: request.session,
                user,
                sessions: server.sessionService
            })
            return {}
        })
        await server.ready()
        const signIn = async (id: string) => {
            const response = await server.inject({
                method: 'POST',
                url: '/session',
                payload: { id }
            })
            expect(response.statusCode).toBe(200)
            const cookie = sessionCookieHeader(response)
            assertExists(cookie, 'Signing in must return a session cookie')
            return cookie
        }
        const request = (cookie: string, address = '198.51.100.1') =>
            server.inject({ method: 'POST', url, remoteAddress: address, headers: { cookie } })
        return { server, signIn, request, sendEmail }
    }

    it('keeps the minute limit and shares the fifteen-minute budget across sessions', async () => {
        const { signIn, request, sendEmail } = await createServer()
        const first = await signIn('account-1')
        const second = await signIn('account-1')
        const other = await signIn('account-2')

        for (let index = 0; index < 5; index += 1) {
            expect((await request(first)).statusCode).toBe(200)
        }
        expect((await request(second, '2001:db8:1:2::1')).statusCode).toBe(429)
        expect(sendEmail).toHaveBeenCalledTimes(5)

        now += 60_001
        for (let index = 0; index < 5; index += 1) {
            expect((await request(second, '2001:db8:1:2::1')).statusCode).toBe(200)
        }
        expect(sendEmail).toHaveBeenCalledTimes(10)

        now += 60_001
        const exceeded = await request(first)
        expect(exceeded.statusCode).toBe(429)
        expect(exceeded.headers['retry-after']).toBe('780')
        expect(sendEmail).toHaveBeenCalledTimes(10)
        expect((await request(other)).statusCode).toBe(200)

        now += 15 * 60_000
        expect((await request(first)).statusCode).toBe(200)
        expect(sendEmail).toHaveBeenCalledTimes(12)
    })

    it('refuses an unsigned request before spending an account budget', async () => {
        const { server, sendEmail } = await createServer()
        const response = await server.inject({ method: 'POST', url })
        expect(response.statusCode).toBe(401)
        expect(sendEmail).not.toHaveBeenCalled()
    })
})
