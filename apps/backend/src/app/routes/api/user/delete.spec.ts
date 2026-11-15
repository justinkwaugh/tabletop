import { assertExists, Role, UserStatus, type User } from '@tabletop/common'
import {
    AccountModeration,
    MemorySessionStore,
    SessionService,
    UserService
} from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import { sessionCookieHeader, sessionServer } from '../../../tests/sessionFixture.js'
import {
    apiErrorShape,
    memoryTokens,
    memoryUserStore,
    recordingTasks
} from '../../../tests/accountFixture.js'
import deleteAccount from './delete.js'

describe('POST /user/delete', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture() {
        const user: User = {
            id: 'deleting-account',
            username: 'Person',
            email: 'person@example.test',
            emailVerified: true,
            status: UserStatus.Active,
            roles: [Role.User],
            externalIds: []
        }
        const sessionStore = new MemorySessionStore()
        const sessions = new SessionService(sessionStore)
        const { store, account } = memoryUserStore(user)
        const { tokenService } = memoryTokens()
        const { tasks } = recordingTasks()
        tasks.createPushTask = vi.fn(async () => {})
        const confirmations = vi.fn(async () => {})
        tasks.sendAccountChangeNotificationEmail = confirmations
        const users = new UserService(store, tokenService, tasks)
        const moderation = new AccountModeration(
            users,
            {
                renamePlayerInGames: vi.fn(async () => {}),
                releaseBannedPlayer: vi.fn(async () => {}),
                anonymizePlayerInGames: vi.fn(async () => {})
            },
            tasks,
            { publishMessage: vi.fn(async () => {}) },
            async () => true,
            {
                sessions,
                tokens: tokenService,
                subscriptions: {
                    findNotificationSubscriptions: vi.fn(async () => []),
                    deleteNotificationSubscription: vi.fn(async () => {})
                }
            }
        )
        const server = await sessionServer(sessions)
        servers.add(server)
        server.decorate('userService', users)
        server.decorate('accountModeration', moderation)
        apiErrorShape(server)
        await server.register(authorization)
        await server.register(deleteAccount, { prefix: '/user' })
        server.post<{ Body: { sessionId: string } }>('/adopt', async (request) => {
            request.session.set('sessionId', request.body.sessionId)
            return {}
        })

        const signIn = async (ageMinutes: number) => {
            const established = await sessions.establish(account(), 'authentication-method')
            const session = await sessionStore.update(established.id, (stored) => ({
                ...stored,
                authenticatedAt: new Date(Date.now() - ageMinutes * 60_000)
            }))
            assertExists(session, 'The fixture session must exist')
            const adopted = await server.inject({
                method: 'POST',
                url: '/adopt',
                payload: { sessionId: session.id }
            })
            const cookie = sessionCookieHeader(adopted)
            assertExists(cookie, 'The fixture must issue a cookie')
            return cookie
        }
        const submit = (cookie: string) =>
            server.inject({ method: 'POST', url: '/user/delete', headers: { cookie } })
        return { account, signIn, submit, confirmations, tasks }
    }

    it('asks for a recent sign-in before deleting anything', async () => {
        const { signIn, submit, account, confirmations } = await fixture()
        const response = await submit(await signIn(16))
        expect(response.statusCode).toBe(403)
        expect(response.json().error.name).toBe('RecentAuthenticationRequiredError')
        expect(account().status).toBe(UserStatus.Active)
        expect(confirmations).not.toHaveBeenCalled()
    })

    it('deletes the account, ends the session and confirms by email', async () => {
        const { signIn, submit, account, confirmations, tasks } = await fixture()
        const cookie = await signIn(1)

        const response = await submit(cookie)

        expect(response.statusCode).toBe(200)
        expect(account()).toMatchObject({ status: UserStatus.Deleted, roles: [] })
        expect(account()).not.toHaveProperty('email')
        expect(confirmations).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'person@example.test' })
        )
        expect(tasks.createPushTask).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/users/releaseDeletedAccount' })
        )
        expect((await submit(cookie)).statusCode).toBe(401)
    })
})
