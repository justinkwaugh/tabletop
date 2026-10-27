import { Role, UserStatus, type User } from '@tabletop/common'
import { MemorySessionStore, SessionService, UserService } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import login from '../auth/login.js'
import logout from '../auth/logout.js'
import setPassword from './setPassword.js'
import update from './update.js'
import { sessionCookieHeader, sessionServer } from '../../../tests/sessionFixture.js'
import {
    memoryChallenges,
    memoryUserStore,
    ORIGINAL_PASSWORD,
    recordingTasks
} from '../../../tests/accountFixture.js'

const NEW_PASSWORD = 'replacement-password-value'

class UndeletableSessionStore extends MemorySessionStore {
    override async deleteForUser(): Promise<void> {
        throw new Error('synthetic revocation failure')
    }
}

async function createServer() {
    const user: User = {
        id: 'account-1',
        username: 'Person',
        email: 'person@example.test',
        emailVerified: true,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: []
    }
    const sessionStore = new UndeletableSessionStore()
    const sessionService = new SessionService(sessionStore)
    const { challengeService } = memoryChallenges()
    const { tasks, lastMail } = recordingTasks()
    const { store, holdLoginsAfterCredentialCheck } = memoryUserStore(user, ORIGINAL_PASSWORD)
    const userService = new UserService(store, challengeService, tasks)
    const server = await sessionServer(sessionService)
    server.decorate('userService', userService)
    await server.register(authorization)
    await server.register(login, { prefix: '/auth' })
    await server.register(logout, { prefix: '/auth' })
    await server.register(setPassword, { prefix: '/user' })
    await server.register(update, { prefix: '/user' })
    server.get('/active', { onRequest: server.auth([server.verifyActiveUser]) }, async () => ({}))

    const startSignIn = (password = ORIGINAL_PASSWORD) =>
        server.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'Person', password }
        })
    const signIn = async (password = ORIGINAL_PASSWORD) => {
        const response = await startSignIn(password)
        expect(response.statusCode).toBe(200)
        const cookie = sessionCookieHeader(response)
        expect(cookie).toBeDefined()
        return cookie
    }
    const active = async (cookie: string | undefined) =>
        (await server.inject({ url: '/active', headers: { cookie } })).statusCode
    const resetChallenge = async () => {
        await userService.sendPasswordResetEmail(user)
        return lastMail('reset').token
    }
    return {
        server,
        sessionStore,
        signIn,
        startSignIn,
        active,
        resetChallenge,
        holdLoginsAfterCredentialCheck
    }
}

describe('sessions across a Password Credential change', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture() {
        const created = await createServer()
        servers.add(created.server)
        return created
    }

    it('ends every session when the password is set through a Set Password Challenge and establishes none', async () => {
        const { server, sessionStore, signIn, active, resetChallenge } = await fixture()
        const copied = await signIn()
        const victim = await signIn()
        expect(await active(copied)).toBe(200)

        const reset = await server.inject({
            method: 'POST',
            url: '/user/setPassword',
            payload: { password: NEW_PASSWORD, challenge: await resetChallenge() }
        })
        expect(reset.statusCode).toBe(200)
        expect(sessionCookieHeader(reset)).toBeUndefined()

        expect(await active(copied)).toBe(401)
        expect(await active(victim)).toBe(401)
        expect(sessionStore.size).toBe(0)
        expect(await signIn(NEW_PASSWORD)).toBeDefined()
    })

    it('revokes a copied session when the password is changed with the current password', async () => {
        const { server, sessionStore, signIn, active } = await fixture()
        const copied = await signIn()
        const victim = await signIn()

        const change = await server.inject({
            method: 'POST',
            url: '/user/update',
            headers: { cookie: victim },
            payload: { password: NEW_PASSWORD, currentPassword: ORIGINAL_PASSWORD }
        })
        expect(change.statusCode).toBe(200)
        const renewed = sessionCookieHeader(change)
        expect(renewed).toBeDefined()

        expect(await active(copied)).toBe(401)
        expect(await active(victim)).toBe(401)
        expect(await active(renewed)).toBe(200)
        expect(sessionStore.size).toBe(1)
    })

    it('keeps every session through a profile update without a password', async () => {
        const { server, sessionStore, signIn, active } = await fixture()
        const other = await signIn()
        const current = await signIn()
        const rename = await server.inject({
            method: 'POST',
            url: '/user/update',
            headers: { cookie: current },
            payload: { username: 'Renamed' }
        })
        expect(rename.statusCode).toBe(200)
        expect(sessionCookieHeader(rename)).toBeUndefined()
        expect(await active(other)).toBe(200)
        expect(await active(current)).toBe(200)
        expect(sessionStore.size).toBe(2)
    })

    it('ends a copied session when the password changes although the session store cannot delete it', async () => {
        const { server, sessionStore, signIn, active } = await fixture()
        const copied = await signIn()
        const victim = await signIn()
        await expect(sessionStore.deleteForUser('account-1')).rejects.toThrow()

        const change = await server.inject({
            method: 'POST',
            url: '/user/update',
            headers: { cookie: victim },
            payload: { password: NEW_PASSWORD, currentPassword: ORIGINAL_PASSWORD }
        })
        expect(change.statusCode).toBe(200)
        expect(await active(copied)).toBe(401)
        expect(await active(sessionCookieHeader(change))).toBe(200)
        expect(await signIn(NEW_PASSWORD)).toBeDefined()
    })

    it('refuses a session from a login that passed the old password check while the password changed', async () => {
        const { server, signIn, startSignIn, active, holdLoginsAfterCredentialCheck } =
            await fixture()
        const victim = await signIn()
        const { release, loginReachedGate } = holdLoginsAfterCredentialCheck()
        const attackerLogin = startSignIn(ORIGINAL_PASSWORD)
        await loginReachedGate

        const change = await server.inject({
            method: 'POST',
            url: '/user/update',
            headers: { cookie: victim },
            payload: { password: NEW_PASSWORD, currentPassword: ORIGINAL_PASSWORD }
        })
        expect(change.statusCode).toBe(200)

        release()
        const raced = await attackerLogin
        expect(raced.statusCode).toBe(200)
        expect(await active(sessionCookieHeader(raced))).toBe(401)
        expect(await active(sessionCookieHeader(change))).toBe(200)
    })

    it('refuses the copied session after the victim logs out', async () => {
        const { server, signIn, active } = await fixture()
        const copied = await signIn()
        expect(await active(copied)).toBe(200)
        expect(
            (await server.inject({ url: '/auth/logout', headers: { cookie: copied } })).statusCode
        ).toBe(200)
        expect(await active(copied)).toBe(401)
    })
})
