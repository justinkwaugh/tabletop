import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertExists, Role, sessionGenerationOf, UserStatus, type User } from '@tabletop/common'
import {
    FirestoreTokenStore,
    FirestoreUserStore,
    LocalTaskService,
    TokenService,
    TokenType,
    UserService
} from '@tabletop/backend-services'
import {
    cacheFixture,
    cacheTestClient
} from '../../../../../libs/backend-services/src/cache/tests/cacheFixture.js'
import { isolatedFirestore } from '../../../../../libs/backend-services/src/persistence/firestore/tests/isolatedFirestore.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from './authorization.js'
import tokenLogin from '../routes/api/auth/token/login.js'
import { authSession } from '../lib/session.js'
import { sessionCookieHeader, sessionServer } from '../tests/sessionFixture.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'session authorization against the stored Account',
    { timeout: 20_000 },
    () => {
        const run = `fresh-auth-${Date.now()}`
        const firestore = isolatedFirestore()
        const client = cacheTestClient()
        const { cache } = cacheFixture(client)
        const store = new FirestoreUserStore(cache, firestore)
        const tokenService = new TokenService(new FirestoreTokenStore(firestore))
        const taskService = new LocalTaskService('')
        const userService = new UserService(store, tokenService, taskService)
        const servers = new Set<FastifyInstance>()
        let sequence = 0

        beforeAll(async () => {
            await client.connect()
        })
        afterEach(async () => {
            await Promise.all([...servers].map((server) => server.close()))
            servers.clear()
        })
        afterAll(async () => {
            taskService.close()
            cache.destroy()
            for await (const keys of client.scanIterator({ MATCH: `user-${run}-*`, COUNT: 100 })) {
                if (keys.length) await client.del(keys)
            }
            client.destroy()
            await firestore.terminate()
        })

        async function createAccount(status: UserStatus, roles: Role[] = [Role.User]) {
            const index = sequence++
            const id = `${run}-${index}`
            return store.createUser({
                id,
                status,
                username: `Person${id}`,
                email: `person-${id}@example.test`,
                emailVerified: true,
                roles,
                externalIds: []
            })
        }

        async function createServer(users: UserService = userService) {
            const server = await sessionServer()
            server.decorate('userService', users)
            server.decorate('tokenService', tokenService)
            await server.register(authorization)
            await server.register(tokenLogin, { prefix: '/auth/token' })
            server.post<{ Body: { userId: string } }>('/session', async (request) => {
                const user = await users.getUserForAuthorization(request.body.userId)
                assertExists(user, 'Account to log in')
                await authSession({
                    session: request.session,
                    user,
                    sessions: server.sessionService
                })
                return {}
            })
            server.get('/any', { onRequest: server.auth([server.verifyUser]) }, async (request) =>
                sessionView(request.user)
            )
            server.get(
                '/active',
                { onRequest: server.auth([server.verifyActiveUser]) },
                async () => ({})
            )
            server.get(
                '/incomplete',
                { onRequest: server.auth([server.verifyIncompleteUser]) },
                async () => ({})
            )
            server.get(
                '/admin',
                { onRequest: server.auth([server.verifyUser]), preHandler: server.verifyRoleAdmin },
                async () => ({})
            )
            servers.add(server)
            return server
        }

        function sessionView(user: User | undefined) {
            return user ? { id: user.id, status: user.status, roles: user.roles } : {}
        }

        async function login(server: FastifyInstance, userId: string) {
            const response = await server.inject({
                method: 'POST',
                url: '/session',
                payload: { userId }
            })
            expect(response.statusCode).toBe(200)
            const cookie = sessionCookieHeader(response)
            assertExists(cookie, 'session cookie')
            await userService.getUser(userId)
            return (url: string) => server.inject({ url, headers: { cookie } })
        }

        async function challengeLogin(server: FastifyInstance, account: User) {
            const token = await tokenService.createToken({
                type: TokenType.Authentication,
                data: { userId: account.id, email: account.email }
            })
            return server.inject({ method: 'POST', url: '/auth/token/login', payload: { token } })
        }

        async function cachedAccount(id: string): Promise<User> {
            const entry = await vi.waitFor(async () => {
                const value = await client.get(`user-${id}`)
                expect(value).toMatch(/^V:/)
                return value
            })
            assertExists(entry, `cache entry for ${id}`)
            return JSON.parse(entry.slice('V:'.length))
        }

        function storedRecord(id: string) {
            return firestore.collection('users').doc(id)
        }

        it('lets Active and Incomplete cookies through their permitted routes', async () => {
            const server = await createServer()
            const active = await createAccount(UserStatus.Active)
            const asActive = await login(server, active.id)
            expect((await asActive('/any')).json()).toEqual({
                id: active.id,
                status: UserStatus.Active,
                roles: [Role.User]
            })
            expect((await asActive('/active')).statusCode).toBe(200)
            expect((await asActive('/incomplete')).statusCode).toBe(401)
            expect((await asActive('/admin')).statusCode).toBe(403)

            const incomplete = await createAccount(UserStatus.Incomplete)
            const asIncomplete = await login(server, incomplete.id)
            expect((await asIncomplete('/any')).statusCode).toBe(200)
            expect((await asIncomplete('/active')).statusCode).toBe(401)
            expect((await asIncomplete('/incomplete')).statusCode).toBe(200)
        })

        it('refuses a cookie once Firestore holds Inactive or Deleted while the cache still says Active', async () => {
            for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
                const server = await createServer()
                const account = await createAccount(UserStatus.Active)
                const get = await login(server, account.id)
                expect((await cachedAccount(account.id)).status).toBe(UserStatus.Active)
                expect((await get('/any')).statusCode).toBe(200)
                expect((await challengeLogin(server, account)).statusCode).toBe(200)

                await storedRecord(account.id).update({ status })

                expect((await cachedAccount(account.id)).status).toBe(UserStatus.Active)
                expect((await userService.getUser(account.id))?.status).toBe(UserStatus.Active)
                expect((await get('/any')).statusCode).toBe(401)
                expect((await get('/active')).statusCode).toBe(401)
                expect((await get('/incomplete')).statusCode).toBe(401)
                expect((await get('/admin')).statusCode).toBe(401)
                const refused = await challengeLogin(server, account)
                expect(refused.statusCode).toBe(401)
                expect(sessionCookieHeader(refused)).toBeUndefined()
            }
        })

        it('refuses a cookie once Firestore advanced the Session Generation while the cache still holds the old one', async () => {
            const server = await createServer()
            const account = await createAccount(UserStatus.Active)
            const get = await login(server, account.id)
            expect((await get('/any')).statusCode).toBe(200)

            await storedRecord(account.id).update({
                sessionGeneration: sessionGenerationOf(account) + 1
            })

            expect(sessionGenerationOf(await cachedAccount(account.id))).toBe(
                sessionGenerationOf(account)
            )
            expect((await get('/any')).statusCode).toBe(401)
            expect((await get('/active')).statusCode).toBe(401)
            const renewed = await login(server, account.id)
            expect((await renewed('/any')).statusCode).toBe(200)
        })

        it('applies a direct role change on the next request', async () => {
            const server = await createServer()
            const account = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
            const get = await login(server, account.id)
            expect((await get('/admin')).statusCode).toBe(200)

            await storedRecord(account.id).update({ roles: [Role.User] })

            expect((await cachedAccount(account.id)).roles).toEqual([Role.User, Role.Admin])
            expect((await get('/admin')).statusCode).toBe(403)
            expect((await get('/any')).json()).toEqual({
                id: account.id,
                status: UserStatus.Active,
                roles: [Role.User]
            })
        })
    }
)
