import { Role, UserStatus, type User } from '@tabletop/common'
import { RECENT_AUTHENTICATION_SECONDS, UserService } from '@tabletop/backend-services'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import authorization from '../../../plugins/authorization.js'
import { authSession } from '../../../lib/session.js'
import unlinkExternalAccount from './unlinkExternalAccount.js'
import {
    apiErrorShape,
    memoryChallenges,
    memoryUserStore,
    recordingTasks
} from '../../../tests/accountFixture.js'
import {
    memorySessions,
    sessionCookieHeader,
    sessionServer
} from '../../../tests/sessionFixture.js'

const user: User = {
    id: 'account-1',
    username: 'Person',
    email: 'person@example.test',
    emailVerified: true,
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: ['google:123']
}

async function createServer() {
    let now = new Date('2026-10-27T12:00:00.000Z')
    const { sessionService } = memorySessions({ now: () => now })
    const server = await sessionServer(sessionService)
    apiErrorShape(server)
    const userService = new UserService(
        memoryUserStore(user).store,
        memoryChallenges().challengeService,
        recordingTasks().tasks
    )
    const unlink = vi
        .spyOn(userService, 'unlinkExternalAccount')
        .mockResolvedValue({ ...user, externalIds: [] })
    server.decorate('userService', userService)
    await server.register(authorization)
    await server.register(unlinkExternalAccount, { prefix: '/user' })
    server.post<{ Body: { proof: 'authentication-method' | 'challenge' } }>(
        '/session',
        async (request) => {
            await authSession({
                session: request.session,
                user,
                proof: request.body.proof,
                sessions: sessionService
            })
            return {}
        }
    )
    const signIn = async (proof: 'authentication-method' | 'challenge') => {
        const response = await server.inject({
            method: 'POST',
            url: '/session',
            payload: { proof }
        })
        return sessionCookieHeader(response)
    }
    return {
        server,
        unlink,
        signIn,
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000)),
        unlinkRequest: (cookie: string | undefined) =>
            server.inject({
                method: 'POST',
                url: '/user/unlinkExternalAccount',
                headers: cookie === undefined ? {} : { cookie },
                payload: { externalId: 'google:123' }
            })
    }
}

describe('POST /user/unlinkExternalAccount', () => {
    const servers = new Set<FastifyInstance>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('unlinks for a session with Recent Authentication', async () => {
        const { server, signIn, unlink, unlinkRequest } = await createServer()
        servers.add(server)
        const response = await unlinkRequest(await signIn('authentication-method'))
        expect(response.statusCode).toBe(200)
        expect(response.json().payload.user.externalIds).toEqual([])
        expect(unlink).toHaveBeenCalledWith({ userId: 'account-1', externalId: 'google:123' })
    })

    it('refuses, with the Recent Authentication error, once the proof is fifteen minutes old', async () => {
        const { server, signIn, unlink, unlinkRequest, advance } = await createServer()
        servers.add(server)
        const cookie = await signIn('authentication-method')
        advance(RECENT_AUTHENTICATION_SECONDS)
        const response = await unlinkRequest(cookie)
        expect(response.statusCode).toBe(403)
        expect(response.json().error.name).toBe('RecentAuthenticationRequiredError')
        expect(unlink).not.toHaveBeenCalled()
    })

    it('refuses a session established through a challenge, which carries no proof', async () => {
        const { server, signIn, unlink, unlinkRequest } = await createServer()
        servers.add(server)
        const response = await unlinkRequest(await signIn('challenge'))
        expect(response.statusCode).toBe(403)
        expect(unlink).not.toHaveBeenCalled()
    })

    it('refuses without a session', async () => {
        const { server, unlinkRequest } = await createServer()
        servers.add(server)
        expect((await unlinkRequest(undefined)).statusCode).toBe(401)
    })
})
