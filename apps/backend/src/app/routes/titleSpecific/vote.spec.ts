import fastifyAuth from '@fastify/auth'
import { Role, UserStatus, type User } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import voteRoutes from './vote.js'
import { routeTestDefinition } from './tests/routeTestDefinition.js'

const user: User = { id: 'user-1', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
const definition = routeTestDefinition('vote-test', 'Tests player vote routes.')
const game = { id: 'game-1' }

async function createServer() {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyUser', async (request: { user?: User }) => {
        request.user = user
    })
    const gameService = {
        previewUndoVote: vi.fn(async () => ({ targetActionId: 'a1' })),
        openUndoVote: vi.fn(async () => game),
        approveVote: vi.fn(async () => game),
        declineVote: vi.fn(async () => game),
        withdrawVote: vi.fn(async () => game)
    }
    Reflect.set(server, 'gameService', gameService)
    await server.register(voteRoutes.bind(undefined, () => definition))
    return { server, gameService }
}

describe('player vote routes', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('passes each request to the game service as the signed-in user', async () => {
        const { server, gameService } = await createServer()
        servers.add(server)

        const calls = [
            [
                '/vote/undo/preview',
                { gameId: 'game-1', actionIndex: 3 },
                gameService.previewUndoVote
            ],
            [
                '/vote/undo/open',
                { gameId: 'game-1', actionIndex: 3, targetActionId: 'a1' },
                gameService.openUndoVote
            ],
            ['/vote/approve', { gameId: 'game-1', voteId: 'v1' }, gameService.approveVote],
            ['/vote/decline', { gameId: 'game-1', voteId: 'v1' }, gameService.declineVote],
            ['/vote/withdraw', { gameId: 'game-1', voteId: 'v1' }, gameService.withdrawVote]
        ] as const
        for (const [url, payload, handler] of calls) {
            const response = await server.inject({ method: 'POST', url, payload })
            expect(response.statusCode).toBe(200)
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ user, ...payload }))
        }
        expect(gameService.approveVote).toHaveBeenCalledWith(
            expect.objectContaining({ definition })
        )
    })
})
