import fastifyAuth from '@fastify/auth'
import { GameSyncStatus, Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import checkSyncRoute from './checkSync.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer() {
    const server = Fastify()
    await server.register(fastifyAuth)

    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)

    const checkSync = vi.fn(async () => ({
        status: GameSyncStatus.InSync,
        actions: [],
        checksum: 17
    }))
    Reflect.set(server, 'gameService', { checkSync })

    await server.register(checkSyncRoute)
    return { server, checkSync }
}

describe('POST /checkSync', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('synchronizes for the authenticated User without changing the response contract', async () => {
        const { server, checkSync } = await createServer()
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/checkSync',
            payload: { gameId: 'game-1', checksum: 11, index: 3 }
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
            status: 'ok',
            payload: {
                status: GameSyncStatus.InSync,
                actions: [],
                checksum: 17
            }
        })
        expect(checkSync).toHaveBeenCalledWith({
            gameId: 'game-1',
            checksum: 11,
            index: 3,
            user
        })
    })
})
