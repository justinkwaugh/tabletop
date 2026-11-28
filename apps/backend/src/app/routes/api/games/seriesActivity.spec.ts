import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import {
    GameStatus,
    Role,
    UserStatus,
    type Game,
    type SeriesActivity,
    type TimeOffsets,
    type User
} from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import { errorStatusCode } from '../../../lib/errorStatusCode.js'
import seriesActivityRoute from './seriesActivity.js'

const user: User = {
    id: 'series-user',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
const activity: SeriesActivity = { open: [], inProgress: [], recentlyFinished: [] }

async function createServer(
    getSeriesActivity: (seriesId: string, titleIds: string[]) => Promise<SeriesActivity>,
    offsetsFor: (games: Game[]) => Promise<TimeOffsets | undefined> = async () => undefined
) {
    const server = Fastify()
    server.setErrorHandler((error, _request, reply) =>
        reply.code(errorStatusCode(error)).send({ status: 'error', error: { name: error.name } })
    )
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)
    Reflect.set(server, 'timeDifferences', { offsetsFor })
    Reflect.set(server, 'gameService', {
        getSeriesTitleIds: (seriesId: string, roles: Role[]) =>
            seriesId === '18xx' && roles.includes(Role.User) ? ['1830', '1846', '1889'] : [],
        getSeriesActivity
    })
    await server.register(seriesActivityRoute)
    return server
}

describe('series activity requests', () => {
    it('reads every title of the series the user can discover', async () => {
        const getSeriesActivity = vi.fn(async () => activity)
        const server = await createServer(getSeriesActivity)
        try {
            const response = await server.inject('/series-activity/18xx')
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ status: 'ok', payload: { activity } })
            expect(getSeriesActivity).toHaveBeenCalledWith('18xx', ['1830', '1846', '1889'])
        } finally {
            await server.close()
        }
    })

    it('adds the time offsets of the open games and those in progress', async () => {
        const game = (id: string, status: GameStatus): Game => ({
            id,
            typeId: '1889',
            status,
            isPublic: true,
            deleted: false,
            ownerId: 'dana',
            name: id,
            players: [],
            config: {},
            hotseat: false,
            createdAt: new Date('2026-11-27T00:00:00Z'),
            winningPlayerIds: []
        })
        const withGames: SeriesActivity = {
            open: [game('open', GameStatus.WaitingForPlayers)],
            inProgress: [game('started', GameStatus.Started)],
            recentlyFinished: []
        }
        const offsetsFor = vi.fn(async () => ({ dana: 9 }))
        const server = await createServer(async () => withGames, offsetsFor)
        try {
            const response = await server.inject('/series-activity/18xx')
            expect(response.json().payload.timeOffsets).toEqual({ dana: 9 })
            expect(offsetsFor).toHaveBeenCalledWith([...withGames.open, ...withGames.inProgress])
        } finally {
            await server.close()
        }
    })

    it('reads nothing for a series without titles the user can discover', async () => {
        const getSeriesActivity = vi.fn(async () => activity)
        const server = await createServer(getSeriesActivity)
        try {
            expect((await server.inject('/series-activity/unknown')).statusCode).toBe(404)
            expect(getSeriesActivity).not.toHaveBeenCalled()
        } finally {
            await server.close()
        }
    })

    it('reports a temporarily unavailable cache as 503', async () => {
        const server = await createServer(async () => {
            throw Object.assign(new Error('Unavailable'), {
                name: 'TitleActivityUnavailable',
                statusCode: 503
            })
        })
        try {
            const response = await server.inject('/series-activity/18xx')
            expect(response.statusCode).toBe(503)
            expect(response.json().error.name).toBe('TitleActivityUnavailable')
        } finally {
            await server.close()
        }
    })
})
