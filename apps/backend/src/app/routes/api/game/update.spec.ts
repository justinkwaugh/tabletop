import fastifyAuth from '@fastify/auth'
import { PlayerStatus, Role, type Game, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import updateRoute from './update.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer() {
    const server = Fastify()
    await server.register(fastifyAuth)

    Reflect.set(server, 'verifyUser', async (request: { user?: User }) => {
        request.user = user
    })

    const updateGame = vi.fn(
        async (_update: { gameId: string; fields: Partial<Game>; user: User }) => ({
            id: 'game-1'
        })
    )
    Reflect.set(server, 'gameService', { updateGame })

    await server.register(updateRoute)
    return { server, updateGame }
}

describe('POST /update', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('passes only the fields the request supplies', async () => {
        const { server, updateGame } = await createServer()
        servers.add(server)
        const players = [
            { id: 'p1', userId: 'user-1', name: 'One', isHuman: true, status: PlayerStatus.Joined }
        ]

        const response = await server.inject({
            method: 'POST',
            url: '/update',
            payload: { game: { id: 'game-1', players, ownerId: 'someone-else' } }
        })

        expect(response.statusCode).toBe(200)
        expect(updateGame).toHaveBeenCalledTimes(1)
        const fields = updateGame.mock.calls[0]?.[0].fields
        expect(fields && Object.keys(fields)).toEqual(['players'])
        expect(fields).toEqual({ players })
    })
})
