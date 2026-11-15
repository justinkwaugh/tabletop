import { assertExists, Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from '@tabletop/backend-services'
import { afterEach, describe, expect, it, vi } from 'vitest'
import authorization from '../../../plugins/authorization.js'
import {
    memorySessions,
    sessionCookieHeader,
    sessionServer
} from '../../../tests/sessionFixture.js'
import {
    apiErrorShape,
    memoryTokens,
    memoryUserStore,
    recordingTasks
} from '../../../tests/accountFixture.js'
import login from './login.js'
import reauthenticate from './reauthenticate.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
afterEach(() => vi.restoreAllMocks())

describe('the shared password authentication budget', () => {
    it.each(['login', 'reauthenticate'] as const)(
        'shares the target allowance across routes and sessions, starting with %s',
        async (first) => {
            let now = Date.now()
            vi.spyOn(Date, 'now').mockImplementation(() => now)
            const user: User = {
                id: 'budget-account',
                username: 'BudgetAccount',
                email: 'budget@example.test',
                emailVerified: true,
                status: UserStatus.Active,
                roles: [Role.User],
                externalIds: [],
                hasPassword: true
            }
            const { sessionService } = memorySessions()
            const { store } = memoryUserStore(user, 'original-synthetic-password')
            const { tokenService } = memoryTokens()
            const { tasks } = recordingTasks()
            const users = new UserService(store, tokenService, tasks)
            const checkPassword = vi.spyOn(users, 'getUserByUsernameAndPassword')
            const server = await sessionServer(sessionService)
            try {
                server.decorate('userService', users)
                apiErrorShape(server)
                await server.register(authorization)
                await server.register(login, { prefix: '/auth' })
                await server.register(reauthenticate, { prefix: '/auth' })
                server.post('/adopt', async (request) => {
                    const session = await sessionService.establish(user, 'authentication-method')
                    request.session.set('sessionId', session.id)
                    request.session.set('userId', user.id)
                    return {}
                })
                const signIn = async () => {
                    const response = await server.inject({ method: 'POST', url: '/adopt' })
                    const cookie = sessionCookieHeader(response)
                    assertExists(cookie, 'The budget fixture issues a session cookie')
                    return cookie
                }
                const one = await signIn()
                const two = await signIn()
                const submit = (route: string, cookie = one) =>
                    server.inject({
                        method: 'POST',
                        url: `/auth/${route}`,
                        headers: { cookie },
                        payload:
                            route === 'login'
                                ? { username: ' BUDGETACCOUNT ', password: 'wrong-password' }
                                : { password: 'wrong-password' }
                    })
                const second = first === 'login' ? 'reauthenticate' : 'login'
                for (let attempt = 0; attempt < 10; attempt++) {
                    expect((await submit(first)).statusCode).toBe(401)
                }
                now += 60_001
                for (let attempt = 0; attempt < 10; attempt++) {
                    expect((await submit(second, two)).statusCode).toBe(401)
                }
                now += 60_001
                const refused = await submit(first, two)
                expect(refused.statusCode).toBe(429)
                expect(refused.headers['retry-after']).toBe('780')
                expect((await submit(second)).statusCode).toBe(429)
                expect(checkPassword).toHaveBeenCalledTimes(20)
                expect(
                    (
                        await server.inject({
                            method: 'POST',
                            url: '/auth/login',
                            payload: { username: 'another-account', password: 'wrong-password' }
                        })
                    ).statusCode
                ).toBe(401)
                now += 15 * 60_000
                expect((await submit('reauthenticate')).statusCode).toBe(401)
                expect(checkPassword).toHaveBeenCalledTimes(22)
            } finally {
                await server.close()
            }
        }
    )
})
