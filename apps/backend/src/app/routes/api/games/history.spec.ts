import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import { Role, UserStatus, type User } from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import historyRoute from './history.js'
import mineRoute from './mine.js'

const user: User = {
    id: 'history-user',
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
    const getActiveGamesForUser = vi.fn(async () => [])
    const getCompletedGamesForUser = vi.fn(async () => [])
    const getGameHistoryForUser = vi.fn(async () => ({ games: [], nextCursor: 'next' }))
    Reflect.set(server, 'gameService', {
        getActiveGamesForUser,
        getCompletedGamesForUser,
        getGameHistoryForUser
    })
    await server.register(historyRoute)
    await server.register(mineRoute)
    return { server, getActiveGamesForUser, getCompletedGamesForUser, getGameHistoryForUser }
}

describe('dashboard game requests', () => {
    it('keeps current requests out of completed storage while preserving legacy requests', async () => {
        const { server, getActiveGamesForUser, getCompletedGamesForUser } = await createServer()
        try {
            expect((await server.inject('/mine?scope=current')).statusCode).toBe(200)
            expect(getActiveGamesForUser).toHaveBeenCalledWith(user)
            expect(getCompletedGamesForUser).not.toHaveBeenCalled()
            expect((await server.inject('/mine')).statusCode).toBe(200)
            expect(getCompletedGamesForUser).toHaveBeenCalledWith(user)
        } finally {
            await server.close()
        }
    })
    it('passes stable history cursors and authenticates each request', async () => {
        const { server, getGameHistoryForUser } = await createServer()
        try {
            const cursor = { time: 1700000000000, id: 'finished-game' }
            const response = await server.inject(
                `/history?before=${encodeURIComponent(JSON.stringify(cursor))}`
            )
            expect(response.statusCode).toBe(200)
            expect(getGameHistoryForUser).toHaveBeenCalledWith(user, cursor)
            expect(response.json().payload.nextCursor).toBe('next')
        } finally {
            await server.close()
        }
    })
    it('rejects malformed cursors before accessing game storage', async () => {
        const { server, getGameHistoryForUser } = await createServer()
        try {
            for (const cursor of [
                'bad json',
                JSON.stringify({ time: -1, id: 'game' }),
                JSON.stringify({ time: Date.now() + 100000, id: 'game' }),
                JSON.stringify({ time: 1, id: 'other/game' })
            ]) {
                expect(
                    (await server.inject(`/history?before=${encodeURIComponent(cursor)}`))
                        .statusCode
                ).toBe(400)
            }
            expect(getGameHistoryForUser).not.toHaveBeenCalled()
        } finally {
            await server.close()
        }
    })
})
