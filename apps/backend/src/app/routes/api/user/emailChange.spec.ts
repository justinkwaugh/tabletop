import { assertExists, Role, UserStatus, type User } from '@tabletop/common'
import { MemorySessionStore, SessionService, UserService } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import { authSession } from '../../../lib/session.js'
import { sessionCookieHeader, sessionServer } from '../../../tests/sessionFixture.js'
import {
    apiErrorShape,
    memoryTokens,
    memoryUserStore,
    recordingRealtime,
    recordingTasks
} from '../../../tests/accountFixture.js'
import emailChange from './emailChange.js'
import update from './update.js'

const servers = new Set<FastifyInstance>()
afterEach(async () => {
    await Promise.all([...servers].map((server) => server.close()))
    servers.clear()
    vi.restoreAllMocks()
})

async function fixture() {
    const user: User = {
        id: 'email-change-account',
        username: 'Player',
        email: 'old@example.test',
        emailVerified: true,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: []
    }
    const { store, account } = memoryUserStore(user, 'original-password')
    const { tasks, mails, lastMail } = recordingTasks()
    const { tokenService } = memoryTokens()
    const sessionService = new SessionService(new MemorySessionStore())
    const server = await sessionServer(sessionService)
    servers.add(server)
    apiErrorShape(server)
    server.decorate('userService', new UserService(store, tokenService, tasks))
    const { realtimeControl, revocations } = recordingRealtime()
    server.decorate('realtimeControl', realtimeControl)
    await server.register(authorization)
    await server.register(emailChange, { prefix: '/user' })
    await server.register(update, { prefix: '/user' })
    server.post<{ Body: { recent: boolean } }>('/session', async (request) => {
        await authSession({
            session: request.session,
            user: account(),
            sessions: sessionService,
            proof: {
                authenticatedAt: new Date(Date.now() - (request.body.recent ? 0 : 16 * 60_000))
            }
        })
        return {}
    })
    server.get(
        '/active',
        { onRequest: server.auth([server.verifyActiveUser]) },
        async (request) => request.user
    )
    const signIn = async (recent = true) => {
        const response = await server.inject({
            method: 'POST',
            url: '/session',
            payload: { recent }
        })
        expect(response.statusCode).toBe(200)
        const cookie = sessionCookieHeader(response)
        assertExists(cookie, 'Fixture sign-in returns its cookie')
        return cookie
    }
    const request = (cookie: string, email = 'new@example.test') =>
        server.inject({
            method: 'POST',
            url: '/user/email/change',
            headers: { cookie },
            payload: { email }
        })
    return { server, account, mails, lastMail, signIn, request, revocations }
}

describe('verified email replacement', () => {
    it('rejects an unstoreable proposed address before issuing a challenge or sending a code', async () => {
        const { server, signIn, request, mails, account } = await fixture()
        const cookie = await signIn()
        const response = await request(cookie, 'first__middle__last@example.test')

        expect(response.statusCode).toBe(400)
        expect(response.json().error.name).toBe('InvalidIDError')
        expect(mails).toHaveLength(0)
        const pending = await server.inject({ url: '/user/email/change', headers: { cookie } })
        expect(pending.json().payload.pending).toBeNull()
        expect(account()).toMatchObject({
            email: 'old@example.test',
            emailVerified: true,
            status: UserStatus.Active
        })
    })

    it('keeps Active access while pending and retains only the confirming session after verification', async () => {
        const { server, signIn, request, lastMail, account, revocations } = await fixture()
        const current = await signIn()
        const copied = await signIn()
        const start = await request(current)
        expect(start.statusCode).toBe(200)
        expect(start.json().payload.pending.email).toBe('new@example.test')
        const mail = lastMail('verification')
        expect(mail.email).toBe('new@example.test')
        expect(start.body).not.toContain(mail.token)
        expect(account()).toMatchObject({
            email: 'old@example.test',
            emailVerified: true,
            status: UserStatus.Active
        })
        expect(
            (await server.inject({ url: '/active', headers: { cookie: copied } })).statusCode
        ).toBe(200)
        const lookup = await server.inject({
            url: '/user/email/change',
            headers: { cookie: current }
        })
        expect(lookup.json().payload.pending).toEqual(start.json().payload.pending)
        expect(revocations).toEqual([])
        const confirmed = await server.inject({
            method: 'POST',
            url: '/user/email/change/confirm',
            headers: { cookie: current },
            payload: { email: 'new@example.test', code: mail.token }
        })
        expect(confirmed.statusCode).toBe(200)
        expect(revocations).toEqual([{ revoke: account().id, at: expect.any(Number) }])
        expect(confirmed.json().payload.user).toMatchObject({
            email: 'new@example.test',
            emailVerified: true,
            status: UserStatus.Active
        })
        const renewed = sessionCookieHeader(confirmed)
        expect(renewed).toBeDefined()
        expect(
            (await server.inject({ url: '/active', headers: { cookie: renewed } })).statusCode
        ).toBe(200)
        for (const cookie of [current, copied]) {
            expect((await server.inject({ url: '/active', headers: { cookie } })).statusCode).toBe(
                401
            )
        }
    })

    it('requires Recent Authentication to request or confirm and ordinary authorization to inspect or cancel', async () => {
        const { server, signIn, request, mails, lastMail, revocations } = await fixture()
        const stale = await signIn(false)
        expect((await request(stale)).statusCode).toBe(403)
        expect(mails).toHaveLength(0)
        const current = await signIn()
        expect((await request(current)).statusCode).toBe(200)
        expect(
            (
                await server.inject({
                    method: 'POST',
                    url: '/user/email/change/confirm',
                    headers: { cookie: stale },
                    payload: { email: 'new@example.test', code: lastMail('verification').token }
                })
            ).statusCode
        ).toBe(403)
        expect((await server.inject({ url: '/user/email/change' })).statusCode).toBe(401)
        expect(
            (await server.inject({ method: 'DELETE', url: '/user/email/change' })).statusCode
        ).toBe(401)
        expect(
            (
                await server.inject({
                    method: 'DELETE',
                    url: '/user/email/change',
                    headers: { cookie: stale }
                })
            ).statusCode
        ).toBe(200)
        expect(
            (
                await server.inject({ url: '/user/email/change', headers: { cookie: current } })
            ).json().payload.pending
        ).toBeNull()
        expect(revocations).toEqual([])
    })

    it('refuses old clients replacing the verified address through a profile update', async () => {
        const { server, signIn, account, mails } = await fixture()
        const cookie = await signIn()
        const response = await server.inject({
            method: 'POST',
            url: '/user/update',
            headers: { cookie },
            payload: { email: 'new@example.test' }
        })
        expect(response.statusCode).toBe(400)
        expect(response.json().error.name).toBe('EmailChangeError')
        expect(account()).toMatchObject({
            email: 'old@example.test',
            emailVerified: true,
            status: UserStatus.Active
        })
        expect(mails).toHaveLength(0)
    })

    it('shares the email issuance budget across sessions and refuses invalid addresses before queuing', async () => {
        let time = Date.now()
        vi.spyOn(Date, 'now').mockImplementation(() => time)
        const { signIn, request, mails } = await fixture()
        const first = await signIn()
        const second = await signIn()
        expect((await request(first, 'invalid')).statusCode).toBe(400)
        for (let attempt = 0; attempt < 10; attempt += 1) {
            time += 13_000
            expect((await request(attempt % 2 ? first : second)).statusCode).toBe(200)
        }
        const refused = await request(second)
        expect(refused.statusCode).toBe(429)
        expect(refused.headers['retry-after']).toBeDefined()
        expect(mails).toHaveLength(10)
    })
})
