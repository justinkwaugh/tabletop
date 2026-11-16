import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify, { type FastifyRequest } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sseHooks from './autohooks.js'
import gameRoute from './game.js'
import tokenRoute from './token.js'
import userRoute from './user.js'

vi.mock('@tabletop/backend-services', () => ({
    GLOBAL_TOPIC: 'global',
    TokenType: { SSEAuthorization: 'sseAuthorization' },
    userTopic: (userId: string) => `user-${userId}`,
    gameTopic: (gameId: string) => `game-${gameId}`
}))

const user: User = {
    id: 'u1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer({ sseEnabled }: { sseEnabled: boolean }) {
    const server = Fastify()
    await server.register(fastifyAuth)
    server.decorate('verifyActiveUser', async (request: FastifyRequest) => {
        request.user = user
    })
    server.decorate('verifyRoleUser', async () => undefined)
    server.decorate('ssePubSub', sseEnabled ? {} : undefined)
    const tokenService = {
        createToken: vi.fn(async () => 'sse-token'),
        getData: vi.fn(async () => undefined)
    }
    server.decorate('tokenService', tokenService)
    // As route autoloading registers a folder: its autohooks unencapsulated, then its routes.
    await server.register(async (folder) => {
        await sseHooks(folder)
        await folder.register(tokenRoute)
        await folder.register(userRoute)
        await folder.register(gameRoute)
    })
    return { server, tokenService }
}

describe('SSE routes', () => {
    const servers: ReturnType<typeof Fastify>[] = []

    afterEach(async () => {
        await Promise.all(servers.map((server) => server.close()))
        servers.length = 0
    })

    it.each(['/token', '/user/t1', '/game/g1/t1'])(
        'answer 404 at %s when SSE is not enabled',
        async (url) => {
            const { server, tokenService } = await createServer({ sseEnabled: false })
            servers.push(server)
            const response = await server.inject({ method: 'GET', url })
            expect(response.statusCode).toBe(404)
            expect(tokenService.createToken).not.toHaveBeenCalled()
            expect(tokenService.getData).not.toHaveBeenCalled()
        }
    )

    it('issue a stream token when SSE is enabled', async () => {
        const { server, tokenService } = await createServer({ sseEnabled: true })
        servers.push(server)
        const response = await server.inject({ method: 'GET', url: '/token' })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ status: 'ok', payload: { token: 'sse-token' } })
        expect(tokenService.createToken).toHaveBeenCalledWith(
            expect.objectContaining({ data: { userId: 'u1' } })
        )
    })

    it.each(['/user/t1', '/game/g1/t1'])(
        'check the stream token at %s when SSE is enabled',
        async (url) => {
            const { server, tokenService } = await createServer({ sseEnabled: true })
            servers.push(server)
            const response = await server.inject({ method: 'GET', url })
            expect(response.statusCode).toBe(401)
            expect(tokenService.getData).toHaveBeenCalledWith({
                token: 't1',
                expectedType: 'sseAuthorization'
            })
        }
    )
})
