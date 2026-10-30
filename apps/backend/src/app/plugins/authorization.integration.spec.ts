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
    RealtimeControl,
    REALTIME_CONTROL_CHANNEL,
    UserService,
    type RealtimeRevocation
} from '@tabletop/backend-services'
import { isolatedFirestore } from '../../../../../libs/backend-services/src/persistence/firestore/tests/isolatedFirestore.js'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
    vi.stubEnv('REDIS_HOST', process.env.CACHE_TEST_REDIS_HOST ?? '')
})
import authorization from './authorization.js'
import adminMode from '../routes/api/auth/adminMode.js'
import passwordLogin from '../routes/api/auth/login.js'
import accountStatus from '../routes/api/admin/users/status.js'
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
        const PASSWORD = 'original-password-value'
        const firestore = isolatedFirestore()
        const challenges = new TokenService(new FirestoreTokenStore(firestore))
        const taskService = new LocalTaskService('')
        const servers = new Set<FastifyInstance>()
        const revocations: RealtimeRevocation[] = []
        const realtimeControl = new RealtimeControl({
            publishMessage: async ({ topic, message }) => {
                expect(topic).toBe(REALTIME_CONTROL_CHANNEL)
                revocations.push(JSON.parse(message))
            }
        })
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
            server.decorate('realtimeControl', realtimeControl)
            apiErrorShape(server)
            await server.register(authorization)
            await server.register(adminMode, { prefix: '/auth' })
            await server.register(passwordLogin, { prefix: '/auth' })
            await server.register(accountStatus, { prefix: '/admin/users' })
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
            return (url: string, method: 'GET' | 'POST' = 'GET', payload?: object) =>
                server.inject({ method, url, headers: { cookie }, payload })
        }

        async function createPasswordAccount(roles: Role[] = [Role.User]) {
            const draft = newAccount(UserStatus.Active, roles)
            return store.createUser({ ...draft, username: `Person${draft.id}` }, PASSWORD)
        }

        function passwordSignIn(server: FastifyInstance, account: User) {
            return server.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { username: account.username, password: PASSWORD }
            })
        }

        async function adminInAdminMode(server: FastifyInstance) {
            const admin = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
            const asAdmin = await login(server, admin.id)
            await activateAdminMode(asAdmin)
            return asAdmin
        }

        function statusChange(
            asAdmin: Awaited<ReturnType<typeof login>>,
            userId: string,
            transition: string
        ) {
            return asAdmin(`/admin/users/${userId}/status`, 'POST', { transition })
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
            const account = await createPasswordAccount([Role.User, Role.Admin])
            const get = await login(server, account.id)
            expect((await cachedAccount(account.id)).id).toBe(account.id)
            expect((await get('/any')).statusCode).toBe(200)
            expectCacheHit(lastTrace())
            await activateAdminMode(get)

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
            expect((await get('/admin-mode')).statusCode).toBe(401)
            const renewed = await login(server, account.id)
            expect((await renewed('/any')).statusCode).toBe(200)
            expectCacheHit(lastTrace())
            // A new session starts outside Admin Mode even for an Administrator
            const outside = await renewed('/admin-mode')
            expect(outside.statusCode).toBe(403)
            expect(outside.json().error.name).toBe('AdminModeRequiredError')
            await activateAdminMode(renewed)
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
            expect(revocations.at(-1)).toMatchObject({ revoke: account.id })

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

        it('applies a role change written through the store on the next request, ending the Admin Mode the session holds', async () => {
            const { server, lastTrace } = await createServer()
            const account = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
            const get = await login(server, account.id)
            expect((await cachedAccount(account.id)).roles).toEqual([Role.User, Role.Admin])
            expect((await get('/admin')).statusCode).toBe(200)
            expectCacheHit(lastTrace())
            expect((await get('/admin-mode')).statusCode).toBe(403)
            await activateAdminMode(get)

            await store.updateUser({ userId: account.id, fields: { roles: [Role.User] } })

            await expectNoCachedAccount(account.id)
            expect((await get('/admin')).statusCode).toBe(403)
            expectCacheMiss(lastTrace())
            expect((await get('/admin-mode')).statusCode).toBe(403)
            expect((await get('/auth/admin-mode/activate', 'POST')).statusCode).toBe(403)
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

        it('deactivates an Account from Admin Mode, ending its warm sessions for good', async () => {
            const { server, lastTrace } = await createServer()
            const asAdmin = await adminInAdminMode(server)
            const target = await createPasswordAccount()
            const asTarget = await login(server, target.id)
            expect((await cachedAccount(target.id)).status).toBe(UserStatus.Active)
            for (let request = 0; request < 5; request++) {
                expect((await asTarget('/active')).statusCode).toBe(200)
                expectCacheHit(lastTrace())
            }
            const staleTarget = await userService.getUser(target.id)
            assertExists(staleTarget, 'target Account read before the deactivation')

            const deactivated = await statusChange(asAdmin, target.id, 'deactivate')
            expect(deactivated.statusCode).toBe(200)
            expect(deactivated.json().payload.user).toMatchObject({
                id: target.id,
                status: UserStatus.Inactive,
                sessionGeneration: sessionGenerationOf(target) + 1
            })
            expect(revocations.at(-1)).toMatchObject({ revoke: target.id })

            await expectNoCachedAccount(target.id)
            expect((await asTarget('/any')).statusCode).toBe(401)
            expectCacheMiss(lastTrace())
            expect((await cachedAccount(target.id)).status).toBe(UserStatus.Inactive)
            expect((await asTarget('/active')).statusCode).toBe(401)
            const refused = await passwordSignIn(server, target)
            expect(refused.statusCode).toBe(401)
            expect(sessionCookieHeader(refused)).toBeUndefined()
            // A sign-in that read the Account before the deactivation committed
            const stale = await server.sessionService.establish(
                staleTarget,
                'authentication-method'
            )
            expect(
                await server.sessionService.authorize(stale.id, (id) => userService.getUser(id))
            ).toBeUndefined()

            const again = await statusChange(asAdmin, target.id, 'deactivate')
            expect(again.statusCode).toBe(200)
            expect(again.json().payload.user.sessionGeneration).toBe(
                sessionGenerationOf(target) + 1
            )

            const reactivated = await statusChange(asAdmin, target.id, 'reactivate')
            expect(reactivated.statusCode).toBe(200)
            expect(reactivated.json().payload.user).toMatchObject({
                status: UserStatus.Active,
                sessionGeneration: sessionGenerationOf(target) + 1
            })
            expect((await asTarget('/any')).statusCode).toBe(401)
            expect(
                await server.sessionService.authorize(stale.id, (id) => userService.getUser(id))
            ).toBeUndefined()
            const renewed = await passwordSignIn(server, target)
            expect(renewed.statusCode).toBe(200)
            const renewedCookie = sessionCookieHeader(renewed)
            assertExists(renewedCookie, 'renewed session cookie')
            const asRenewed = await server.inject({
                url: '/active',
                headers: { cookie: renewedCookie }
            })
            expect(asRenewed.statusCode).toBe(200)
        })

        it('refuses a status change outside Admin Mode, from a non-administrator, and for a Deleted Account', async () => {
            const { server } = await createServer()
            const target = await createAccount(UserStatus.Active)
            const admin = await createAccount(UserStatus.Active, [Role.User, Role.Admin])
            const asAdminOutsideMode = await login(server, admin.id)
            const outside = await statusChange(asAdminOutsideMode, target.id, 'deactivate')
            expect(outside.statusCode).toBe(403)
            expect(outside.json().error.name).toBe('AdminModeRequiredError')
            const asOrdinary = await login(server, (await createAccount(UserStatus.Active)).id)
            expect((await statusChange(asOrdinary, target.id, 'deactivate')).statusCode).toBe(403)
            expect(
                (
                    await server.inject({
                        method: 'POST',
                        url: `/admin/users/${target.id}/status`,
                        payload: { transition: 'deactivate' }
                    })
                ).statusCode
            ).toBe(401)
            expect((await userService.getUser(target.id))?.status).toBe(UserStatus.Active)

            const asAdmin = await adminInAdminMode(server)
            const deleted = await createAccount(UserStatus.Deleted)
            for (const transition of ['deactivate', 'reactivate']) {
                const refused = await statusChange(asAdmin, deleted.id, transition)
                expect(refused.statusCode).toBe(400)
                expect(refused.json().error.name).toBe('AccountStatusTransitionError')
            }
            expect((await statusChange(asAdmin, target.id, 'delete')).statusCode).toBe(400)
            expect((await statusChange(asAdmin, 'no-such-account', 'deactivate')).statusCode).toBe(
                400
            )
        })

        it('never grants Admin Mode to a session of an Account without the Admin role', async () => {
            const { server } = await createServer()
            const account = await createAccount(UserStatus.Active)
            const get = await login(server, account.id)
            expect((await get('/auth/admin-mode/activate', 'POST')).statusCode).toBe(403)
            expect((await get('/admin-mode')).statusCode).toBe(403)
        })
    }
)
