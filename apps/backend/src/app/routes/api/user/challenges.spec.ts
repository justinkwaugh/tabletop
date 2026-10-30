import {
    AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS,
    Role,
    UserStatus,
    type User
} from '@tabletop/common'
import { MemorySessionStore, SessionService, UserService } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import login from '../auth/login.js'
import sendPasswordReset from './email/sendPasswordReset.js'
import resendEmailVerification from './resendEmailVerification.js'
import sendEmailAuthVerification from './sendEmailAuthVerification.js'
import setPassword from './setPassword.js'
import update from './update.js'
import verifyEmail from './verifyEmail.js'
import { sessionCookieHeader, sessionServer } from '../../../tests/sessionFixture.js'
import {
    apiErrorShape,
    memoryTokens,
    memoryUserStore,
    ORIGINAL_PASSWORD,
    recordingTasks
} from '../../../tests/accountFixture.js'

const NEW_PASSWORD = 'replacement-password-value'

function person(overrides: Partial<User> = {}): User {
    return {
        id: 'account-1',
        username: 'Person',
        email: 'person@example.test',
        emailVerified: true,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: [],
        ...overrides
    }
}

async function createServer(
    user: User,
    { withPassword = true, now }: { withPassword?: boolean; now?: () => Date } = {}
) {
    const password = withPassword ? ORIGINAL_PASSWORD : undefined
    const sessionStore = new MemorySessionStore()
    const sessionService = new SessionService(sessionStore)
    const { tokenService } = memoryTokens({ now })
    const { tasks, mails, lastMail } = recordingTasks()
    const { store, account } = memoryUserStore(user, password)
    const userService = new UserService(store, tokenService, tasks)
    const server = await sessionServer(sessionService)
    apiErrorShape(server)
    Reflect.set(server, 'userService', userService)
    await server.register(authorization)
    server.post<{ Body: { sessionId: string } }>('/adopt', async (request) => {
        request.session.set('sessionId', request.body.sessionId)
        return {}
    })
    await server.register(login, { prefix: '/auth' })
    await server.register(setPassword, { prefix: '/user' })
    await server.register(verifyEmail, { prefix: '/user' })
    await server.register(resendEmailVerification, { prefix: '/user' })
    await server.register(sendEmailAuthVerification, { prefix: '/user' })
    await server.register(update, { prefix: '/user' })
    await server.register(sendPasswordReset, { prefix: '/user/email' })

    const adoptSession = async () => {
        const established = await sessionService.establish(account(), 'authentication-method')
        const response = await server.inject({
            method: 'POST',
            url: '/adopt',
            payload: { sessionId: established.id }
        })
        const cookie = sessionCookieHeader(response)
        if (!cookie) throw new Error('no session cookie issued')
        return cookie
    }
    const cookieFor = async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: user.username, password }
        })
        expect(response.statusCode).toBe(200)
        return sessionCookieHeader(response)
    }
    const post = (url: string, payload: unknown, cookie?: string) =>
        server.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })
    const requestReset = () => post('/user/email/sendPasswordReset', { email: user.email })
    return {
        server,
        sessionStore,
        userService,
        mails,
        lastMail,
        account,
        cookieFor,
        adoptSession,
        post,
        requestReset
    }
}

describe('Set Password through an emailed challenge', () => {
    const servers = new Set<FastifyInstance>()
    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })
    async function fixture(user = person(), options: { now?: () => Date } = {}) {
        const created = await createServer(user, options)
        servers.add(created.server)
        return created
    }

    it('answers a reset request with the lifetime whether or not an Account matches', async () => {
        const { post, mails } = await fixture()
        const before = Date.now()
        const known = await post('/user/email/sendPasswordReset', { email: 'Person@Example.test' })
        const unknown = await post('/user/email/sendPasswordReset', {
            email: 'nobody@example.test'
        })
        for (const response of [known, unknown]) {
            expect(response.statusCode).toBe(200)
            const expiresAt = Date.parse(response.json().payload.expiresAt)
            expect(expiresAt - before).toBeGreaterThanOrEqual(
                AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS * 1000 - 1000
            )
            expect(expiresAt - before).toBeLessThanOrEqual(
                AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS * 1000 + 1000
            )
        }
        expect(mails.filter((mail) => mail.kind === 'reset')).toHaveLength(1)
    })

    it('sends nothing to an Inactive or Deleted Account and still answers alike', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const { requestReset, mails } = await fixture(person({ status }))
            const response = await requestReset()
            expect(response.statusCode).toBe(200)
            expect(response.json().payload.expiresAt).toBeDefined()
            expect(mails).toEqual([])
        }
    })

    it('sets the password without a session and without establishing one', async () => {
        const { post, requestReset, lastMail, cookieFor, sessionStore, account } = await fixture()
        const earlier = await cookieFor()
        await requestReset()
        const challenge = lastMail('reset').token
        expect(challenge.startsWith('account-1.')).toBe(true)

        const response = await post('/user/setPassword', { password: NEW_PASSWORD, challenge })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ status: 'ok', payload: {} })
        expect(sessionCookieHeader(response)).toBeUndefined()
        expect(account().sessionGeneration).toBe(1)
        expect((await post('/user/update', { username: 'X' }, earlier)).statusCode).toBe(401)
        expect(sessionStore.size).toBe(0)
        expect(await cookieFor().catch(() => undefined)).toBeUndefined()
        const fresh = await post('/auth/login', { username: 'Person', password: NEW_PASSWORD })
        expect(fresh.statusCode).toBe(200)
    })

    it('does not expose Account or challenge state through a refused public reset', async () => {
        let now = new Date()
        const { post, requestReset, lastMail } = await fixture(person(), { now: () => now })
        const refused = async (challenge: string) => {
            const response = await post('/user/setPassword', { password: NEW_PASSWORD, challenge })
            expect(response.statusCode).toBe(400)
            return response.json()
        }
        const expected = await refused('legacy-token')
        expect(expected.error.name).toBe('InvalidChallengeError')
        expect(expected.error.metadata).toEqual({})
        expect(await refused('unknown-account.secret')).toEqual(expected)
        expect(await refused('account-1.secret')).toEqual(expected)
        await requestReset()
        expect(await refused('account-1.wrong-secret')).toEqual(expected)
        now = new Date(now.getTime() + AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS * 1000)
        expect(await refused(lastMail('reset').token)).toEqual(expected)
        for (const overrides of [
            { status: UserStatus.Inactive },
            { status: UserStatus.Deleted },
            { email: undefined }
        ]) {
            const other = await fixture(person(overrides))
            const response = await other.post('/user/setPassword', {
                password: NEW_PASSWORD,
                challenge: 'account-1.secret'
            })
            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual(expected)
        }
    })

    it('rejects a legacy token, a forged secret, another Account and a replayed challenge', async () => {
        const { post, requestReset, lastMail, account } = await fixture()
        await requestReset()
        const challenge = lastMail('reset').token
        const secret = challenge.slice('account-1.'.length)
        const attempts = [
            ['legacy', 'Lk3mNp'],
            ['forged', `account-1.${'x'.repeat(32)}`],
            ['other account', `account-2.${secret}`]
        ]
        for (const [, presented] of attempts) {
            const response = await post('/user/setPassword', {
                password: NEW_PASSWORD,
                challenge: presented
            })
            expect(response.statusCode).toBe(400)
            expect(response.json().error.name).toBe('InvalidChallengeError')
            expect(JSON.stringify(response.json())).not.toContain(secret)
        }
        expect(account().sessionGeneration).toBeUndefined()

        expect(
            (await post('/user/setPassword', { password: NEW_PASSWORD, challenge })).statusCode
        ).toBe(200)
        const replay = await post('/user/setPassword', {
            password: 'a-third-password-value',
            challenge
        })
        expect(replay.statusCode).toBe(400)
        expect(account().sessionGeneration).toBe(1)
        expect(
            (await post('/auth/login', { username: 'Person', password: NEW_PASSWORD })).statusCode
        ).toBe(200)
    })

    it('honours only the latest of two reset links', async () => {
        const { post, requestReset, lastMail } = await fixture()
        await requestReset()
        const first = lastMail('reset').token
        await requestReset()
        const second = lastMail('reset').token
        expect(
            (await post('/user/setPassword', { password: NEW_PASSWORD, challenge: first }))
                .statusCode
        ).toBe(400)
        expect(
            (await post('/user/setPassword', { password: NEW_PASSWORD, challenge: second }))
                .statusCode
        ).toBe(200)
    })

    it('refuses a short password with the challenge still usable', async () => {
        const { post, requestReset, lastMail } = await fixture()
        await requestReset()
        const challenge = lastMail('reset').token
        expect((await post('/user/setPassword', { password: 'short', challenge })).statusCode).toBe(
            400
        )
        expect(
            (await post('/user/setPassword', { password: NEW_PASSWORD, challenge })).statusCode
        ).toBe(200)
    })
})

describe('Email Verification through a code', () => {
    const servers = new Set<FastifyInstance>()
    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })
    async function fixture() {
        const created = await createServer(
            person({ status: UserStatus.Incomplete, emailVerified: false })
        )
        servers.add(created.server)
        return created
    }

    it('requires a session, returns the expiry and verifies the exact address once', async () => {
        const { post, cookieFor, lastMail, account } = await fixture()
        const cookie = await cookieFor()
        expect((await post('/user/resendEmailVerification', undefined)).statusCode).toBe(401)
        const sent = await post('/user/resendEmailVerification', undefined, cookie)
        expect(sent.statusCode).toBe(200)
        expect(Date.parse(sent.json().payload.expiresAt)).toBeGreaterThan(Date.now())
        const code = lastMail('verification').token
        expect(code).toHaveLength(6)

        expect((await post('/user/email/verify', { code })).statusCode).toBe(401)
        expect((await post('/user/email/verify', { code: 'WRONG1' }, cookie)).statusCode).toBe(400)
        expect(account().emailVerified).toBe(false)
        const verified = await post('/user/email/verify', { code: ` ${code} ` }, cookie)
        expect(verified.statusCode).toBe(200)
        expect(verified.json().payload.user).toMatchObject({
            emailVerified: true,
            status: UserStatus.Active
        })
        expect((await post('/user/email/verify', { code }, cookie)).statusCode).toBe(400)
    })

    it('does not accept a Set Password challenge as a verification code', async () => {
        const { post, cookieFor, requestReset, lastMail, account } = await fixture()
        const cookie = await cookieFor()
        await requestReset()
        const secret = lastMail('reset').token.slice('account-1.'.length)
        expect((await post('/user/email/verify', { code: secret }, cookie)).statusCode).toBe(400)
        expect(account().emailVerified).toBe(false)
    })
})

describe('retired Sensitive Change codes', () => {
    it('tells an older client to reload without issuing an email', async () => {
        const { server, post, adoptSession, mails } = await createServer(
            person({ externalIds: ['discord:linked-user'] }),
            { withPassword: false }
        )
        try {
            const cookie = await adoptSession()
            const response = await post(
                '/user/sendEmailAuthVerification',
                { email: 'next@example.test', password: true },
                cookie
            )
            expect(response.statusCode).toBe(410)
            expect(response.json().error.message).toContain('Reload the site')
            expect(mails).toEqual([])
        } finally {
            await server.close()
        }
    })
})
