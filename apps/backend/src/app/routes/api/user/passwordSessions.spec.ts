import { Role, UserStatus, type User } from '@tabletop/common'
import {
    TokenService,
    TokenType,
    UserService,
    type DataToken,
    type StoredUser,
    type TaskService,
    type TokenStore,
    type UserStore
} from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import login from '../auth/login.js'
import logout from '../auth/logout.js'
import setPassword from './setPassword.js'
import update from './update.js'
import {
    memorySessions,
    sessionCookieHeader,
    sessionServer
} from '../../../tests/sessionFixture.js'

const ORIGINAL_PASSWORD = 'original-password-value'
const NEW_PASSWORD = 'replacement-password-value'

function memoryUserStore(user: User) {
    let password = ORIGINAL_PASSWORD
    const stored = (): StoredUser => ({ ...user, createdAt: undefined, updatedAt: undefined })
    const store: UserStore = Object.create(null)
    store.findById = async (id) => (id === user.id ? user : undefined)
    store.findByUsernameAndPassword = async (username, candidate) =>
        username === user.username && candidate === password ? user : undefined
    store.updatePassword = async (_userId, candidate) => {
        password = candidate
    }
    store.updateUser = async ({ fields, password: candidate, currentPassword, validator }) => {
        validator?.(stored(), fields)
        if (currentPassword !== undefined && currentPassword !== password) {
            throw new Error('wrong current password')
        }
        const updatedFields = Object.entries(fields)
            .filter(([, value]) => value !== undefined)
            .map(([field]) => field)
        if (candidate) {
            password = candidate
            updatedFields.push('password')
        }
        return [user, updatedFields, user]
    }
    return store
}

function memoryTokenStore() {
    const tokens = new Map<string, DataToken>()
    const store: TokenStore = Object.create(null)
    store.find = async (id) => tokens.get(id)
    store.create = async (token) => {
        tokens.set(token.id, token)
        return token
    }
    store.delete = async (id) => {
        tokens.delete(id)
    }
    return store
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
    const { sessionService, sessionStore } = memorySessions()
    const tokenService = new TokenService(memoryTokenStore())
    const tasks: TaskService = Object.create(null)
    tasks.sendAccountChangeNotificationEmail = async () => {}
    const userService = new UserService(memoryUserStore(user), tokenService, tasks, sessionService)
    const server = await sessionServer(sessionService)
    Reflect.set(server, 'userService', userService)
    Reflect.set(server, 'tokenService', tokenService)
    await server.register(authorization)
    await server.register(login, { prefix: '/auth' })
    await server.register(logout, { prefix: '/auth' })
    await server.register(setPassword, { prefix: '/user' })
    await server.register(update, { prefix: '/user' })
    server.get('/active', { onRequest: server.auth([server.verifyActiveUser]) }, async () => ({}))

    const signIn = async (password = ORIGINAL_PASSWORD) => {
        const response = await server.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'Person', password }
        })
        expect(response.statusCode).toBe(200)
        const cookie = sessionCookieHeader(response)
        expect(cookie).toBeDefined()
        return cookie
    }
    const active = async (cookie: string | undefined) =>
        (await server.inject({ url: '/active', headers: { cookie } })).statusCode
    const resetChallenge = () =>
        tokenService.createToken({
            type: TokenType.Authentication,
            data: { userId: user.id, email: user.email }
        })
    return { server, sessionStore, signIn, active, resetChallenge }
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

    it('revokes a copied session when the password is set through a challenge', async () => {
        const { server, sessionStore, signIn, active, resetChallenge } = await fixture()
        const copied = await signIn()
        const victim = await signIn()
        expect(await active(copied)).toBe(200)

        const reset = await server.inject({
            method: 'POST',
            url: '/user/setPassword',
            headers: { cookie: victim },
            payload: { password: NEW_PASSWORD, token: await resetChallenge() }
        })
        expect(reset.statusCode).toBe(200)
        const renewed = sessionCookieHeader(reset)
        expect(renewed).toBeDefined()
        expect(renewed).not.toBe(victim)

        expect(await active(copied)).toBe(401)
        expect(await active(victim)).toBe(401)
        expect(await active(renewed)).toBe(200)
        expect(sessionStore.size).toBe(1)
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
