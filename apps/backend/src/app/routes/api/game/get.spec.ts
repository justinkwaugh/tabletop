import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus, Visibility } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import getGameRoute from './get.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

type GameRepresentationRequest = { gameId: string; hostView: boolean; user: User }

const playerPerspective: Visibility.Perspective = { kind: 'player', playerId: 'player-1' }

async function createServer(
    perspective: Visibility.Perspective | undefined,
    requestUser: User = user
) {
    const server = Fastify()
    await server.register(fastifyAuth)

    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = requestUser
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)

    const getGameEtagForUser = vi.fn(async ({ hostView }: GameRepresentationRequest) =>
        hostView || perspective === undefined ? 'revision-1' : 'player-1-revision-1'
    )
    const getGameForUser = vi.fn(async ({ gameId, hostView }: GameRepresentationRequest) => ({
        game: { id: gameId },
        actions: [],
        perspective: hostView ? undefined : perspective
    }))
    const canAccessHostView = vi.fn(
        (candidate: User) =>
            candidate.roles.includes(Role.Admin) || candidate.roles.includes(Role.Developer)
    )
    Reflect.set(server, 'gameService', {
        canAccessHostView,
        getGameEtagForUser,
        getGameForUser
    })

    await server.register(getGameRoute)
    return { server, canAccessHostView, getGameEtagForUser, getGameForUser }
}

describe('GET /get/:gameId', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('returns and privately revalidates a projected representation when given the canonical ETag', async () => {
        const { server, getGameForUser } = await createServer(playerPerspective)
        servers.add(server)

        const response = await server.inject({
            method: 'GET',
            url: '/get/game-1',
            headers: { 'if-none-match': 'W/"revision-1"' }
        })

        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('private, no-cache')
        expect(response.headers.etag).toBe('W/"player-1-revision-1"')
        expect(response.json()).toEqual({
            status: 'ok',
            payload: { game: { id: 'game-1' }, actions: [] }
        })
        expect(getGameForUser).toHaveBeenCalledWith({
            gameId: 'game-1',
            hostView: false,
            user
        })
    })

    it('returns a projected 304 before materializing state and history', async () => {
        const { server, getGameEtagForUser, getGameForUser } = await createServer(playerPerspective)
        servers.add(server)

        const response = await server.inject({
            method: 'GET',
            url: '/get/game-1',
            headers: { 'if-none-match': 'W/"player-1-revision-1"' }
        })

        expect(response.statusCode).toBe(304)
        expect(response.body).toBe('')
        expect(response.headers.etag).toBe('W/"player-1-revision-1"')
        expect(response.headers['cache-control']).toBe('private, no-cache')
        expect(getGameEtagForUser).toHaveBeenCalledWith({
            gameId: 'game-1',
            hostView: false,
            user
        })
        expect(getGameForUser).not.toHaveBeenCalled()
    })

    it('retains conditional ETag responses for legacy canonical loads', async () => {
        const { server, getGameEtagForUser, getGameForUser } = await createServer(undefined)
        servers.add(server)

        const response = await server.inject({
            method: 'GET',
            url: '/get/game-1',
            headers: { 'if-none-match': 'W/"revision-1"' }
        })

        expect(response.statusCode).toBe(304)
        expect(response.body).toBe('')
        expect(response.headers['cache-control']).toBe('private, no-cache')
        expect(getGameEtagForUser).toHaveBeenCalledWith({
            gameId: 'game-1',
            hostView: false,
            user
        })
        expect(getGameForUser).not.toHaveBeenCalled()
    })

    it('returns the canonical ETag with a changed legacy load', async () => {
        const { server } = await createServer(undefined)
        servers.add(server)

        const response = await server.inject({
            method: 'GET',
            url: '/get/game-1',
            headers: { 'if-none-match': 'W/"older-revision"' }
        })

        expect(response.statusCode).toBe(200)
        expect(response.headers.etag).toBe('W/"revision-1"')
        expect(response.headers['cache-control']).toBe('private, no-cache')
    })

    it.each([Role.Admin, Role.Developer])(
        'returns the canonical Host View for an authorized %s request',
        async (role) => {
            const privilegedUser = { ...user, roles: [Role.User, role] }
            const { server, getGameEtagForUser, getGameForUser } = await createServer(
                playerPerspective,
                privilegedUser
            )
            servers.add(server)

            const response = await server.inject({
                method: 'GET',
                url: '/get/game-1?view=host'
            })

            expect(response.statusCode).toBe(200)
            expect(response.headers.etag).toBe('W/"revision-1"')
            expect(getGameEtagForUser).toHaveBeenCalledWith({
                gameId: 'game-1',
                hostView: true,
                user: privilegedUser
            })
            expect(getGameForUser).toHaveBeenCalledWith({
                gameId: 'game-1',
                hostView: true,
                user: privilegedUser
            })
        }
    )

    it('rejects a Host View request from an ordinary User', async () => {
        const { server, canAccessHostView, getGameEtagForUser, getGameForUser } =
            await createServer(playerPerspective)
        servers.add(server)

        const response = await server.inject({
            method: 'GET',
            url: '/get/game-1?view=host'
        })

        expect(response.statusCode).toBe(403)
        expect(canAccessHostView).toHaveBeenCalledWith(user)
        expect(getGameEtagForUser).not.toHaveBeenCalled()
        expect(getGameForUser).not.toHaveBeenCalled()
    })

    it('keeps an administrator on the projected representation unless Host View is explicit', async () => {
        const admin = { ...user, roles: [Role.User, Role.Admin] }
        const { server, getGameEtagForUser } = await createServer(playerPerspective, admin)
        servers.add(server)

        const response = await server.inject({
            method: 'GET',
            url: '/get/game-1'
        })

        expect(response.statusCode).toBe(200)
        expect(response.headers.etag).toBe('W/"player-1-revision-1"')
        expect(getGameEtagForUser).toHaveBeenCalledWith({
            gameId: 'game-1',
            hostView: false,
            user: admin
        })
    })
})
