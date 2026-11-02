import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertExists, Role, sessionGenerationOf, UserStatus, type User } from '@tabletop/common'
import {
    TokenService,
    TokenType,
    FirestoreTokenStore,
    FirestoreUserStore,
    formatSetPasswordChallenge,
    LocalTaskService,
    UserService
} from '@tabletop/backend-services'
import { isolatedFirestore } from '../../../../../libs/backend-services/src/persistence/firestore/tests/isolatedFirestore.js'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
    vi.stubEnv('REDIS_HOST', process.env.CACHE_TEST_REDIS_HOST ?? '')
})
import authorization from './authorization.js'
import setPassword from '../routes/api/user/setPassword.js'
import { authSession } from '../lib/session.js'
import { apiErrorShape } from '../tests/accountFixture.js'
import { sessionCookieHeader, sessionServer } from '../tests/sessionFixture.js'
import { spanCount, traceRequests, type RequestTrace } from '../tests/requestTraces.js'
import { connectedRedisCache } from '../tests/redisCache.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'session authorization from the cached Account',
    { timeout: 20_000 },
    () => {
        const run = `cached-auth-${Date.now()}`
        const firestore = isolatedFirestore()
        const challenges = new TokenService(new FirestoreTokenStore(firestore))
        const taskService = new LocalTaskService('')
        const servers = new Set<FastifyInstance>()
        let redis: Awaited<ReturnType<typeof connectedRedisCache>>
        let client: typeof redis.client
        let store: FirestoreUserStore
        let userService: UserService
        let sequence = 0

        beforeAll(async () => {
            redis = await connectedRedisCache()
            client = redis.client
            store = new FirestoreUserStore(redis.cache, firestore)
            userService = new UserService(store, challenges, taskService)
        })
        afterEach(async () => {
            await Promise.all([...servers].map((server) => server.close()))
            servers.clear()
        })
        afterAll(async () => {
            taskService.close()
            for await (const keys of client.scanIterator({ MATCH: `user-${run}-*`, COUNT: 100 })) {
                if (keys.length) await client.del(keys)
            }
            redis.close()
            await firestore.terminate()
        })

        function newAccount(status: UserStatus, roles: Role[]): User {
            const index = sequence++
            const id = `${run}-${index}`
            return {
                id,
                status,
                email: `person-${id}@example.test`,
                emailVerified: true,
                roles,
                externalIds: []
            }
        }

        async function createAccount(status: UserStatus, roles: Role[] = [Role.User]) {
            const account = newAccount(status, roles)
            return store.createUser({ ...account, username: `Person${account.id}` })
        }

        async function createServer() {
            const server = await sessionServer()
            const lastTrace = traceRequests(server)
            server.decorate('userService', userService)
            apiErrorShape(server)
            await server.register(authorization)
            await server.register(setPassword, { prefix: '/user' })
            server.post<{ Body: { userId: string } }>('/session', async (request) => {
                const user = await userService.getUser(request.body.userId)
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
            servers.add(server)
            return { server, lastTrace }
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
            return (url: string) => server.inject({ url, headers: { cookie } })
        }

        async function issueSetPasswordChallenge(account: User) {
            assertExists(account.email, 'Account email')
            const issued = await challenges.issueChallenge({
                type: TokenType.PasswordReset,
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

        function storedRecord(id: string) {
            return firestore.collection('users').doc(id)
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

        async function expectNoCachedAccount(id: string) {
            expect(await client.get(`user-${id}`)).not.toMatch(/^V:/)
        }

        function expectCacheHit(trace: RequestTrace) {
            expect(spanCount(trace, 'store.user.findById')).toBe(1)
            expect(trace.counters['cache.hits']).toBeGreaterThanOrEqual(1)
            expect(trace.counters['cache.misses']).toBeUndefined()
            expect(spanCount(trace, 'firestore.user.get')).toBe(0)
        }

        function expectCacheMiss(trace: RequestTrace) {
            expect(spanCount(trace, 'store.user.findById')).toBe(1)
            expect(trace.counters['cache.misses']).toBe(1)
            expect(spanCount(trace, 'firestore.user.get')).toBe(1)
        }

        it('lets Active and Incomplete cookies through their permitted routes', async () => {
            const { server } = await createServer()
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

        it('answers warm session authorization from the user cache without a Firestore read', async () => {
            const { server, lastTrace } = await createServer()
            const account = await createAccount(UserStatus.Active)
            const get = await login(server, account.id)
            expectCacheMiss(lastTrace())
            expect((await cachedAccount(account.id)).status).toBe(UserStatus.Active)

            for (let request = 0; request < 20; request++) {
                const response = await get(request % 2 ? '/active' : '/any')
                expect(response.statusCode).toBe(200)
                expectCacheHit(lastTrace())
            }

            await client.del(`user-${account.id}`)
            expect((await get('/any')).statusCode).toBe(200)
            expectCacheMiss(lastTrace())
            expect((await cachedAccount(account.id)).id).toBe(account.id)
            expect((await get('/any')).statusCode).toBe(200)
            expectCacheHit(lastTrace())
        })

        it('refuses every earlier session once a profile password change advances the Session Generation', async () => {
            const { server, lastTrace } = await createServer()
            const draft = newAccount(UserStatus.Active, [Role.User])
            const account = await store.createUser(
                { ...draft, username: `Person${draft.id}` },
                'original-password-value'
            )
            const get = await login(server, account.id)
            expect((await cachedAccount(account.id)).id).toBe(account.id)
            expect((await get('/any')).statusCode).toBe(200)
            expectCacheHit(lastTrace())

            await userService.updateUser(
                await server.sessionService.establish(account, 'authentication-method'),
                {},
                'replacement-password-value'
            )

            await expectNoCachedAccount(account.id)
            expect((await get('/any')).statusCode).toBe(401)
            expectCacheMiss(lastTrace())
            expect(sessionGenerationOf(await cachedAccount(account.id))).toBe(
                sessionGenerationOf(account) + 1
            )
            expect((await get('/active')).statusCode).toBe(401)
            const renewed = await login(server, account.id)
            expect((await renewed('/any')).statusCode).toBe(200)
            expectCacheHit(lastTrace())
        })

        it('ends every earlier session in the commit that completes a Set Password challenge', async () => {
            const { server, lastTrace } = await createServer()
            const account = await createAccount(UserStatus.Active)
            const get = await login(server, account.id)
            expect((await cachedAccount(account.id)).id).toBe(account.id)
            expect((await get('/any')).statusCode).toBe(200)
            expectCacheHit(lastTrace())
            const challenge = await issueSetPasswordChallenge(account)

            const completed = await completeSetPassword(server, challenge)
            expect(completed.statusCode).toBe(200)
            expect(sessionCookieHeader(completed)).toBeUndefined()

            await expectNoCachedAccount(account.id)
            expect((await get('/any')).statusCode).toBe(401)
            expectCacheMiss(lastTrace())
            const stored = (await storedRecord(account.id).get()).data()
            assertExists(stored, 'stored Account')
            expect(stored.passwordHash).toEqual(expect.any(String))
            expect(sessionGenerationOf(stored)).toBe(sessionGenerationOf(account) + 1)
            expect((await completeSetPassword(server, challenge)).statusCode).toBe(400)
            const renewed = await login(server, account.id)
            expect((await renewed('/any')).statusCode).toBe(200)
        })

        it('applies a role change written through the store on the next request', async () => {
            const { server, lastTrace } = await createServer()
            const account = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
            const get = await login(server, account.id)
            expect((await cachedAccount(account.id)).roles).toEqual([Role.User, Role.Admin])
            expect((await get('/admin')).statusCode).toBe(200)
            expectCacheHit(lastTrace())

            await store.updateUser({ userId: account.id, fields: { roles: [Role.User] } })

            await expectNoCachedAccount(account.id)
            expect((await get('/admin')).statusCode).toBe(403)
            expectCacheMiss(lastTrace())
            expect((await get('/any')).json()).toEqual({
                id: account.id,
                status: UserStatus.Active,
                roles: [Role.User]
            })
            expect((await cachedAccount(account.id)).roles).toEqual([Role.User])
        })

        it('applies Account Completion written through the store on the next request', async () => {
            const { server } = await createServer()
            const account = await store.createUser(newAccount(UserStatus.Incomplete, [Role.User]))
            const get = await login(server, account.id)
            expect((await cachedAccount(account.id)).status).toBe(UserStatus.Incomplete)
            expect((await get('/active')).statusCode).toBe(401)
            expect((await get('/incomplete')).statusCode).toBe(200)

            await store.updateUser({
                userId: account.id,
                fields: { username: `Completed${account.id}` }
            })

            expect((await get('/active')).statusCode).toBe(200)
            expect((await get('/incomplete')).statusCode).toBe(401)
            expect((await cachedAccount(account.id)).status).toBe(UserStatus.Active)
        })
    }
)
