import {
    ConfigOptionType,
    GameStatus,
    PlayerStatus,
    type Game,
    type GameConfigOptions
} from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import publicGameRoute from './public.js'

const game: Game = {
    id: 'public-table',
    typeId: 'sample',
    name: 'Friday night',
    ownerId: 'host',
    status: GameStatus.WaitingForPlayers,
    isPublic: true,
    deleted: false,
    hotseat: false,
    createdAt: new Date(),
    winningPlayerIds: [],
    config: { expert: false },
    seed: 123,
    players: [
        { id: 'p1', name: 'Alice', userId: 'host', status: PlayerStatus.Joined, isHuman: true },
        { id: 'p2', name: '', status: PlayerStatus.Open, isHuman: true }
    ]
}
const options: GameConfigOptions = [
    {
        id: 'expert',
        name: 'Expert rules',
        description: '',
        type: ConfigOptionType.Boolean,
        default: false
    }
]

describe('public game invitation preview', () => {
    const servers: ReturnType<typeof Fastify>[] = []
    afterEach(async () => {
        await Promise.all(servers.splice(0).map((server) => server.close()))
    })

    async function setup(stored: Game | undefined) {
        const server = Fastify()
        servers.push(server)
        const getGame = vi.fn(async () => stored)
        Reflect.set(server, 'gameService', {
            getGame,
            getTitle: () => ({ info: { metadata: { name: 'Sample' }, configurator: { options } } })
        })
        await server.register(publicGameRoute)
        return { server, getGame }
    }

    it('lets anonymous visitors see players and option definitions without returning play data', async () => {
        const { server, getGame } = await setup(game)
        const response = await server.inject('/public/public-table')
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.json()).toEqual({
            status: 'ok',
            payload: {
                id: game.id,
                typeId: game.typeId,
                name: game.name,
                ownerId: game.ownerId,
                status: game.status,
                players: game.players,
                config: game.config,
                titleName: 'Sample',
                configOptions: options
            }
        })
        expect(getGame).toHaveBeenCalledWith({ gameId: game.id })
    })

    it.each([
        undefined,
        { ...game, isPublic: false },
        { ...game, deleted: true },
        { ...game, hotseat: true },
        { ...game, parentId: 'parent' },
        { ...game, status: GameStatus.Deleted },
        { ...game, status: GameStatus.Archived }
    ])('does not expose an unavailable public invitation', async (stored) => {
        const { server } = await setup(stored)
        const response = await server.inject('/public/public-table')
        expect(response.statusCode).toBe(404)
        expect(response.body).toBe('')
    })

    it.each([GameStatus.WaitingToStart, GameStatus.Started, GameStatus.Finished])(
        'keeps the preview readable after the game becomes %s',
        async (status) => {
            const { server } = await setup({ ...game, status })
            const response = await server.inject('/public/public-table')
            expect(response.statusCode).toBe(200)
            expect(response.json().payload.status).toBe(status)
        }
    )
})
