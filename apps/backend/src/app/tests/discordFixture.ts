import { vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { LightMyRequestResponse } from 'fastify'
import { ExternalAuthService, Role, UserStatus, type User } from '@tabletop/common'
import type { AuthenticationProof, DiscordIdentity, DiscordOAuth } from '@tabletop/backend-services'
import authorization from '../plugins/authorization.js'
import { authSession } from '../lib/session.js'
import discordBegin from '../routes/api/auth/discord/begin.js'
import discordLogin from '../routes/api/auth/discord/login.js'
import discordLink from '../routes/api/auth/discord/link.js'
import discordReauthenticate from '../routes/api/auth/discord/reauthenticate.js'
import passwordReauthenticate from '../routes/api/auth/reauthenticate.js'
import { memorySessions, sessionCookieHeader, sessionServer } from './sessionFixture.js'

export const START = new Date('2026-10-27T12:00:00.000Z')
export const PASSWORD = 'correct-horse-battery-staple'

export const identities: Record<string, DiscordIdentity> = {
    'attacker-code': { externalId: 'attacker-discord-id' },
    'victim-code': { externalId: 'victim-discord-id', email: 'victim@example.test' },
    'stranger-code': {
        externalId: 'stranger-discord-id',
        email: 'stranger@example.test',
        emailVerified: true
    }
}

export function account(id: string, externalIds: string[] = []): User {
    return {
        id,
        username: id,
        email: `${id}@example.test`,
        emailVerified: true,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds,
        hasPassword: true
    }
}

export async function discordFixture() {
    let now = START
    const { sessionService, sessionStore } = memorySessions({ now: () => now })
    const spentCodes = new Set<string>()
    const exchangeCode = vi.fn(async ({ code }: { code: string; redirectUri: string }) => {
        if (spentCodes.has(code)) {
            return undefined
        }
        spentCodes.add(code)
        return identities[code]
    })
    const discordOAuth: DiscordOAuth = {
        authorizationUrl: ({ redirectUri, state }) =>
            `https://discord.test/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
        exchangeCode
    }
    const users = new Map<string, User>()
    const register = (user: User) => {
        users.set(user.id, user)
        return user
    }
    register(account('victim'))
    register(account('attacker'))
    const byExternalId = (service: ExternalAuthService, externalId: string) =>
        [...users.values()].find((user) => user.externalIds.includes(`${service}:${externalId}`))
    const linkExternalAccount = vi.fn(
        async ({
            userId,
            externalId,
            service
        }: {
            userId: string
            externalId: string
            service: ExternalAuthService
        }) => {
            const user = users.get(userId)
            if (!user) throw new Error('unknown user')
            return register({
                ...user,
                externalIds: [...user.externalIds, `${service}:${externalId}`]
            })
        }
    )
    const handleExternalAuth = vi.fn(
        async ({ service, externalId }: { service: ExternalAuthService; externalId: string }) =>
            byExternalId(service, externalId) ??
            register(account(`created-${externalId}`, [`${service}:${externalId}`]))
    )
    const server = await sessionServer(sessionService)
    server.decorate('discordOAuth', discordOAuth)
    Reflect.set(server, 'userService', {
        getUser: async (id: string) => users.get(id),
        getUserByUsernameAndPassword: async (username: string, password: string) =>
            password === PASSWORD ? users.get(username) : undefined,
        linkExternalAccount,
        handleExternalAuth
    })
    await server.register(authorization)
    await server.register(discordBegin, { prefix: '/auth/discord' })
    await server.register(discordLogin, { prefix: '/auth/discord' })
    await server.register(discordLink, { prefix: '/auth/discord' })
    await server.register(discordReauthenticate, { prefix: '/auth/discord' })
    await server.register(passwordReauthenticate, { prefix: '/auth' })
    server.post<{ Body: { userId: string; proof: AuthenticationProof } }>(
        '/session',
        async (request) => {
            const user = users.get(request.body.userId)
            if (!user) throw new Error('unknown user')
            const session = await authSession({
                session: request.session,
                user,
                proof: request.body.proof,
                sessions: sessionService
            })
            return { sessionId: session.id }
        }
    )
    server.get('/any', { onRequest: server.auth([server.verifyUser]) }, async (request) => ({
        id: request.user?.id,
        sessionId: request.authenticatedSession?.id
    }))

    const cookieOf = (response: LightMyRequestResponse) => {
        const cookie = sessionCookieHeader(response)
        if (!cookie) throw new Error('expected a session cookie')
        return cookie
    }
    const signIn = async (userId: string, proof: AuthenticationProof = 'authentication-method') => {
        const response = await server.inject({
            method: 'POST',
            url: '/session',
            payload: { userId, proof }
        })
        return { cookie: cookieOf(response), sessionId: String(response.json().sessionId) }
    }
    const post = (
        url: string,
        payload: unknown,
        cookie?: string
    ): Promise<LightMyRequestResponse> =>
        server.inject({
            method: 'POST',
            url,
            ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
            headers: {
                ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
                ...(cookie ? { cookie } : {})
            }
        })
    const begin = async (purpose: string, cookie?: string) => {
        const response = await post(`/auth/discord/begin/${purpose}`, undefined, cookie)
        return {
            response,
            state: response.statusCode === 200 ? String(response.json().payload.state) : '',
            cookie: sessionCookieHeader(response) ?? cookie
        }
    }
    return {
        server,
        sessionStore,
        exchangeCode,
        linkExternalAccount,
        handleExternalAuth,
        users,
        signIn,
        post,
        begin,
        cookieOf,
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000))
    }
}

export type DiscordFixture = Awaited<ReturnType<typeof discordFixture>>

export function closing(servers: Set<FastifyInstance>) {
    return async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    }
}
