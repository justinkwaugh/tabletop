import { assertExists, Role, UserStatus, type User } from '@tabletop/common'
import { SessionService, UserService, MemorySessionStore } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import { sessionCookieHeader, sessionServer } from '../../../tests/sessionFixture.js'
import {
    apiErrorShape,
    memoryTokens,
    memoryUserStore,
    ORIGINAL_PASSWORD,
    recordingTasks
} from '../../../tests/accountFixture.js'
import reauthenticate from '../auth/reauthenticate.js'
import update from './update.js'

const NEW_PASSWORD = 'replacement-password-value'

describe('Recent Authentication for profile submissions', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture({ withPassword = true } = {}) {
        const user: User = {
            id: 'profile-account',
            username: 'Person',
            email: 'person@example.test',
            emailVerified: true,
            status: UserStatus.Active,
            roles: [Role.User],
            externalIds: ['discord:linked-user'],
            hasPassword: withPassword
        }
        const sessionStore = new MemorySessionStore()
        const sessions = new SessionService(sessionStore)
        const { store, account } = memoryUserStore(
            user,
            withPassword ? ORIGINAL_PASSWORD : undefined
        )
        const { tokenService } = memoryTokens()
        const { tasks, mails } = recordingTasks()
        const users = new UserService(store, tokenService, tasks)
        const server = await sessionServer(sessions)
        servers.add(server)
        server.decorate('userService', users)
        apiErrorShape(server)
        await server.register(authorization)
        await server.register(update, { prefix: '/user' })
        await server.register(reauthenticate, { prefix: '/auth' })
        server.get(
            '/current',
            { onRequest: server.auth([server.verifyUser]) },
            async (request) => ({
                id: request.authenticatedSession?.id
            })
        )
        server.post<{ Body: { sessionId: string } }>('/adopt', async (request) => {
            request.session.set('sessionId', request.body.sessionId)
            return {}
        })

        const signIn = async (ageMinutes = 0, withoutProof = false) => {
            const established = await sessions.establish(
                account(),
                withoutProof ? 'challenge' : 'authentication-method'
            )
            const session = await sessionStore.update(established.id, (stored) => ({
                ...stored,
                ...(withoutProof
                    ? {}
                    : { authenticatedAt: new Date(Date.now() - ageMinutes * 60_000) })
            }))
            assertExists(session, 'The fixture session must exist')
            const adopted = await server.inject({
                method: 'POST',
                url: '/adopt',
                payload: { sessionId: session.id }
            })
            const cookie = sessionCookieHeader(adopted)
            assertExists(cookie, 'The fixture must issue a cookie')
            return { session, cookie }
        }
        const submit = (cookie: string, payload: unknown) =>
            server.inject({ method: 'POST', url: '/user/update', headers: { cookie }, payload })
        return { server, sessions, sessionStore, users, account, mails, signIn, submit }
    }

    it.each([
        { email: 'new@example.test' },
        { password: NEW_PASSWORD },
        { email: 'new@example.test', password: NEW_PASSWORD }
    ])(
        'refuses a sensitive submission with old proof before changing anything: %j',
        async (change) => {
            const { signIn, submit, account, mails } = await fixture()
            const { cookie } = await signIn(16)
            const original = account()
            const response = await submit(cookie, change)
            expect(response.statusCode).toBe(403)
            expect(response.json().error.name).toBe('RecentAuthenticationRequiredError')
            expect(account()).toEqual(original)
            expect(mails).toEqual([])
        }
    )

    it('does not accept the old inline password or email-code fields as recent proof', async () => {
        const { signIn, submit, account } = await fixture()
        const { cookie } = await signIn(16)
        const response = await submit(cookie, {
            password: NEW_PASSWORD,
            currentPassword: ORIGINAL_PASSWORD,
            challenge: 'OLD123'
        })
        expect(response.statusCode).toBe(403)
        expect(response.json().error.name).toBe('RecentAuthenticationRequiredError')
        expect(account().sessionGeneration).toBeUndefined()
    })

    it('lets a username-only submission proceed with old proof', async () => {
        const { signIn, submit, account } = await fixture()
        const { cookie } = await signIn(16)
        expect((await submit(cookie, { username: 'Renamed' })).statusCode).toBe(200)
        expect(account().username).toBe('Renamed')
    })

    it('does not prompt for an unchanged email address', async () => {
        const { signIn, submit } = await fixture()
        const { cookie } = await signIn(16)
        expect((await submit(cookie, { email: 'person@example.test' })).statusCode).toBe(200)
    })

    it('allows a recently authenticated Account with a password to change it without resending it', async () => {
        const { signIn, submit, account } = await fixture()
        const { cookie } = await signIn(5)
        expect((await submit(cookie, { password: NEW_PASSWORD })).statusCode).toBe(200)
        expect(account().sessionGeneration).toBe(1)
    })

    it('allows a passwordless provider Account to change email and establish a password', async () => {
        const { signIn, submit, account, mails } = await fixture({ withPassword: false })
        const { cookie } = await signIn(5)
        const response = await submit(cookie, {
            email: 'next@example.test',
            password: NEW_PASSWORD
        })
        expect(response.statusCode).toBe(200)
        expect(account()).toMatchObject({
            email: 'next@example.test',
            emailVerified: false,
            hasPassword: true,
            sessionGeneration: 1
        })
        expect(mails.map((mail) => mail.kind)).toEqual(['verification'])
    })

    it('requires confirmation when a live session has no authentication proof', async () => {
        const { signIn, submit } = await fixture({ withPassword: false })
        const { cookie } = await signIn(0, true)
        expect((await submit(cookie, { email: 'next@example.test' })).statusCode).toBe(403)
    })

    it('accepts the same submission after the existing password reauthentication route succeeds', async () => {
        const { server, signIn, submit } = await fixture()
        const { cookie } = await signIn(16)
        const change = { password: NEW_PASSWORD }
        expect((await submit(cookie, change)).statusCode).toBe(403)
        const confirmation = await server.inject({
            method: 'POST',
            url: '/auth/reauthenticate',
            headers: { cookie },
            payload: { password: ORIGINAL_PASSWORD }
        })
        expect(confirmation.statusCode).toBe(200)
        expect((await submit(cookie, change)).statusCode).toBe(200)
    })

    it('preserves the original proof time while the password change ends older sessions', async () => {
        const { server, signIn, submit, sessions, sessionStore, account } = await fixture()
        const copied = await signIn()
        const current = await signIn(14)
        const response = await submit(current.cookie, { password: NEW_PASSWORD })
        expect(response.statusCode).toBe(200)
        expect(sessionCookieHeader(response)).toBeDefined()
        expect(await sessions.authorize(copied.session.id, async () => account())).toBeUndefined()
        expect(await sessions.authorize(current.session.id, async () => account())).toBeUndefined()
        const renewed = await server.inject({
            url: '/current',
            headers: { cookie: sessionCookieHeader(response) }
        })
        expect(renewed.statusCode).toBe(200)
        const remaining = await sessionStore.find(renewed.json<{ id: string }>().id)
        expect(sessionStore.size).toBe(1)
        expect(remaining?.authenticatedAt).toEqual(current.session.authenticatedAt)
    })
})
