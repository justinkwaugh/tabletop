import fastifyAuth from '@fastify/auth'
import { GameStatus, Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import overviewRoute from './overview.js'

const player: User = {
    id: 'user-2',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer() {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async () => undefined)
    Reflect.set(server, 'verifyRoleAdmin', async () => undefined)
    const forAdministrator = vi.fn(async () => ({
        webPushBrowsers: ['Chrome'],
        discordBot: true,
        telegram: false
    }))
    const getActiveGamesForUser = vi.fn(async () => [{ id: 'g-1', status: GameStatus.Started }])
    const getCompletedGamesForUser = vi.fn(async () => [{ id: 'g-2', status: GameStatus.Finished }])
    Reflect.set(server, 'topicRegistrationsService', { forAdministrator })
    Reflect.set(server, 'userService', {
        getUser: async (userId: string) => (userId === player.id ? player : undefined)
    })
    Reflect.set(server, 'gameService', { getActiveGamesForUser, getCompletedGamesForUser })
    await server.register(overviewRoute)
    return { server, forAdministrator, getActiveGamesForUser, getCompletedGamesForUser }
}

describe('admin user overview', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it("returns the player's notification channels", async () => {
        const { server, forAdministrator } = await createServer()
        servers.add(server)

        const response = await server.inject({ method: 'GET', url: '/user-2/notifications' })

        expect(response.statusCode).toBe(200)
        expect(forAdministrator).toHaveBeenCalledWith('user-2')
        expect(response.json().payload.registrations.webPushBrowsers).toEqual(['Chrome'])
    })

    it("returns the player's active games before their finished ones", async () => {
        const { server, getActiveGamesForUser, getCompletedGamesForUser } = await createServer()
        servers.add(server)

        const response = await server.inject({ method: 'GET', url: '/user-2/games' })

        expect(response.statusCode).toBe(200)
        expect(getActiveGamesForUser).toHaveBeenCalledWith(player)
        expect(getCompletedGamesForUser).toHaveBeenCalledWith(player)
        expect(response.json().payload.games.map((game: { id: string }) => game.id)).toEqual([
            'g-1',
            'g-2'
        ])
    })

    it('answers 404 for an unknown account', async () => {
        const { server } = await createServer()
        servers.add(server)

        const response = await server.inject({ method: 'GET', url: '/missing/games' })

        expect(response.statusCode).toBe(404)
    })
})
