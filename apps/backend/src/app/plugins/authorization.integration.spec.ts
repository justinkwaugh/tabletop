import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertExists, Role, sessionGenerationOf, UserStatus, type User } from '@tabletop/common'
import {
    AuthenticationChallengeService,
    FirestoreAuthenticationChallengeStore,
    FirestoreUserStore,
    formatSetPasswordChallenge,
    LocalTaskService,
    UserService
} from '@tabletop/backend-services'
import {
    cacheFixture,
    cacheTestClient
} from '../../../../../libs/backend-services/src/cache/tests/cacheFixture.js'
import { isolatedFirestore } from '../../../../../libs/backend-services/src/persistence/firestore/tests/isolatedFirestore.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from './authorization.js'
import adminMode from '../routes/api/auth/adminMode.js'
import setPassword from '../routes/api/user/setPassword.js'
import { authSession } from '../lib/session.js'
import { apiErrorShape } from '../tests/accountFixture.js'
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
        const challenges = new AuthenticationChallengeService(
            new FirestoreAuthenticationChallengeStore(firestore)
        )
        const taskService = new LocalTaskService('')
        const userService = new UserService(store, challenges, taskService)
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
            apiErrorShape(server)
            await server.register(authorization)
            await server.register(adminMode, { prefix: '/auth' })
            await server.register(setPassword, { prefix: '/user' })
            server.post<{ Body: { userId: string } }>('/session', async (request) => {
                const user = await users.getUserForAuthorization(request.body.userId)
                assertExists(user, 'Account to log in')
                await authSession({
                    session: request.session,
                    user,
                    proof: 'authentication-method',
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
            server.get(
                '/admin-mode',
                {
                    onRequest: server.auth([server.verifyActiveUser, server.verifyAdminMode], {
                        relation: 'and'
                    })
                },
                async (request) => ({ adminMode: request.principal?.adminMode })
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
            return (url: string, method: 'GET' | 'POST' = 'GET') =>
                server.inject({ method, url, headers: { cookie } })
        }

        // The sign-in above counts as Recent Authentication, so an Administrator can enter
        // Admin Mode on the session straight away.
        async function activateAdminMode(get: Awaited<ReturnType<typeof login>>) {
            const activated = await get('/auth/admin-mode/activate', 'POST')
            expect(activated.statusCode).toBe(200)
            expect(activated.json().payload.adminMode.expiresAt).toEqual(expect.any(String))
            expect((await get('/admin-mode')).json()).toEqual({ adminMode: true })
        }

        async function issueSetPasswordChallenge(account: User) {
            assertExists(account.email, 'Account email')
            const issued = await challenges.issue({
                purpose: 'set-password',
                userId: account.id,
                email: account.email
            })
            return formatSetPasswordChallenge({ userId: account.id, secret: issued.secret })
        }

        function completeSetPassword(server: FastifyInstance, challenge: string) {
            return server.inject({
                method: 'POST',
                url: '/user/setPassword',
                payload: { password: 'replacement-password-value', challenge }
            })
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
                const account = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
                const get = await login(server, account.id)
                expect((await cachedAccount(account.id)).status).toBe(UserStatus.Active)
                expect((await get('/any')).statusCode).toBe(200)
                await activateAdminMode(get)
                const challenge = await issueSetPasswordChallenge(account)

                await storedRecord(account.id).update({ status })

                expect((await cachedAccount(account.id)).status).toBe(UserStatus.Active)
                expect((await userService.getUser(account.id))?.status).toBe(UserStatus.Active)
                expect((await get('/any')).statusCode).toBe(401)
                expect((await get('/active')).statusCode).toBe(401)
                expect((await get('/incomplete')).statusCode).toBe(401)
                expect((await get('/admin')).statusCode).toBe(401)
                expect((await get('/admin-mode')).statusCode).toBe(401)
                const refused = await completeSetPassword(server, challenge)
                expect(refused.statusCode).toBe(400)
                expect(refused.json().error.name).toBe('InvalidChallengeError')
                expect(sessionCookieHeader(refused)).toBeUndefined()
                const stored = (await storedRecord(account.id).get()).data()
                assertExists(stored, 'stored Account')
                expect(stored.passwordHash).toBeUndefined()
                expect(sessionGenerationOf(stored)).toBe(sessionGenerationOf(account))
            }
        })

        it('refuses a cookie once Firestore advanced the Session Generation while the cache still holds the old one', async () => {
            const server = await createServer()
            const account = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
            const get = await login(server, account.id)
            expect((await get('/any')).statusCode).toBe(200)
            await activateAdminMode(get)

            await storedRecord(account.id).update({
                sessionGeneration: sessionGenerationOf(account) + 1
            })

            expect(sessionGenerationOf(await cachedAccount(account.id))).toBe(
                sessionGenerationOf(account)
            )
            expect((await get('/any')).statusCode).toBe(401)
            expect((await get('/active')).statusCode).toBe(401)
            expect((await get('/admin-mode')).statusCode).toBe(401)
            const renewed = await login(server, account.id)
            expect((await renewed('/any')).statusCode).toBe(200)
            // A new session starts outside Admin Mode even for an Administrator
            const outside = await renewed('/admin-mode')
            expect(outside.statusCode).toBe(403)
            expect(outside.json().error.name).toBe('AdminModeRequiredError')
            await activateAdminMode(renewed)
        })

        it('applies a direct role change on the next request, ending the Admin Mode the session holds', async () => {
            const server = await createServer()
            const account = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
            const get = await login(server, account.id)
            expect((await get('/admin')).statusCode).toBe(200)
            expect((await get('/admin-mode')).statusCode).toBe(403)
            await activateAdminMode(get)

            await storedRecord(account.id).update({ roles: [Role.User] })

            expect((await cachedAccount(account.id)).roles).toEqual([Role.User, Role.Admin])
            expect((await get('/admin')).statusCode).toBe(403)
            expect((await get('/admin-mode')).statusCode).toBe(403)
            expect((await get('/auth/admin-mode/activate', 'POST')).statusCode).toBe(403)
            expect((await get('/any')).json()).toEqual({
                id: account.id,
                status: UserStatus.Active,
                roles: [Role.User]
            })
        })

        it('never grants Admin Mode to a session of an Account without the Admin role', async () => {
            const server = await createServer()
            const account = await createAccount(UserStatus.Active)
            const get = await login(server, account.id)
            expect((await get('/auth/admin-mode/activate', 'POST')).statusCode).toBe(403)
            expect((await get('/admin-mode')).statusCode).toBe(403)
        })
    }
)
