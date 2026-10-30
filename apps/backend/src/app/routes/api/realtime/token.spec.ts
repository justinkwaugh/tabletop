import fastifyAuth from '@fastify/auth'
import { Role, type Principal, type User, UserStatus, ordinaryPrincipal } from '@tabletop/common'
import type { AuthenticatedSession } from '@tabletop/backend-services'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import tokenRoute from './token.js'
import { authorizedAs } from '../../../tests/principalFixture.js'

vi.mock('@tabletop/backend-services', () => ({
    GLOBAL_TOPIC: 'global',
    RELAY_STATS_TOPIC: 'relay-stats',
    userTopic: (userId: string) => `user-${userId}`,
    gameTopic: (gameId: string) => `game-${gameId}`
}))

const user: User = {
    id: 'u1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const adminModeExpiresAt = new Date('2026-10-27T12:15:00.000Z')

function sessionInAdminMode(): AuthenticatedSession {
    return {
        id: 'session-1',
        userId: user.id,
        generation: 0,
        createdAt: new Date('2026-10-27T12:00:00.000Z'),
        authenticatedAt: new Date('2026-10-27T12:00:00.000Z'),
        adminModeExpiresAt,
        expiresAt: new Date('2026-11-26T12:00:00.000Z')
    }
}

async function createServer({
    withIssuer = true,
    principal = ordinaryPrincipal(user),
    session
}: { withIssuer?: boolean; principal?: Principal; session?: AuthenticatedSession } = {}) {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', authorizedAs(principal, session))
    Reflect.set(server, 'verifyRoleUser', async () => undefined)
    const issue = vi.fn(
        ({ topics, until }: { userId: string; topics: string[]; until?: Record<string, Date> }) =>
            [
                ...topics,
                ...Object.entries(until ?? {}).map(
                    ([topic, end]) => `${topic}<${end.toISOString()}`
                )
            ].join(',')
    )
    Reflect.set(server, 'realtimeTokenIssuer', withIssuer ? { issue } : undefined)
    await server.register(tokenRoute)
    return { server, issue }
}

describe('GET /token', () => {
    const servers: ReturnType<typeof Fastify>[] = []

    afterEach(async () => {
        await Promise.all(servers.map((server) => server.close()))
        servers.length = 0
    })

    it('grants the user and global topics', async () => {
        const { server, issue } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token' })
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.json()).toEqual({ status: 'ok', payload: { token: 'user-u1,global' } })
        expect(issue).toHaveBeenCalledWith({
            userId: 'u1',
            topics: ['user-u1', 'global'],
            until: undefined
        })
    })

    it('adds the relay stats topic, granted until the mode ends, for an admin in Admin Mode who asks for it', async () => {
        const { server } = await createServer({
            principal: { user: { ...user, roles: [Role.User, Role.Admin] }, adminMode: true },
            session: sessionInAdminMode()
        })
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?relayStats=true' })
        expect(response.json().payload.token).toBe(
            'user-u1,global,relay-stats,relay-stats<2026-10-27T12:15:00.000Z'
        )
    })

    it('leaves the relay stats topic out when the session carries no end for the mode', async () => {
        const { server } = await createServer({
            principal: { user: { ...user, roles: [Role.User, Role.Admin] }, adminMode: true },
            session: { ...sessionInAdminMode(), adminModeExpiresAt: undefined }
        })
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?relayStats=true' })
        expect(response.json().payload.token).toBe('user-u1,global')
    })

    it('leaves the relay stats topic out for an admin outside Admin Mode', async () => {
        const { server } = await createServer({
            principal: ordinaryPrincipal({ ...user, roles: [Role.User, Role.Admin] })
        })
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?relayStats=true' })
        expect(response.statusCode).toBe(200)
        expect(response.json().payload.token).toBe('user-u1,global')
    })

    it('leaves the relay stats topic out for anyone who is not an admin', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?relayStats=true' })
        expect(response.statusCode).toBe(200)
        expect(response.json().payload.token).toBe('user-u1,global')
    })

    it('adds the game topic for a game that exists', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?game=g1' })
        expect(response.json().payload.token).toBe('user-u1,global,game-g1')
    })

    it('adds a topic for each requested game', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?game=g1&game=g2' })
        expect(response.json().payload.token).toBe('user-u1,global,game-g1,game-g2')
    })

    it('grants a game topic without looking the game up', async () => {
        const { server } = await createServer()
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token?game=g1&game=g1' })
        expect(response.json().payload.token).toBe('user-u1,global,game-g1')
    })

    it('is absent when the relay is not configured', async () => {
        const { server } = await createServer({ withIssuer: false })
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token' })
        expect(response.statusCode).toBe(404)
    })
})
