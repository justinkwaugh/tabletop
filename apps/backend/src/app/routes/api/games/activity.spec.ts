import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import { Role, UserStatus, type TitleActivity, type User } from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import { errorStatusCode } from '../../../lib/errorStatusCode.js'
import activityRoute from './activity.js'

const user: User = {
    id: 'activity-user',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer(getTitleActivity: (titleId: string) => Promise<TitleActivity>) {
    const server = Fastify()
    server.setErrorHandler((error, _request, reply) =>
        reply.code(errorStatusCode(error)).send({ status: 'error', error: { name: error.name } })
    )
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)
    Reflect.set(server, 'gameService', {
        getTitle: (titleId: string) => (titleId === 'known' ? { id: titleId } : undefined),
        getTitleActivity
    })
    await server.register(activityRoute)
    return server
}

describe('title activity requests', () => {
    it('returns the activity of a known title', async () => {
        const activity: TitleActivity = { inProgress: [], recentlyFinished: [] }
        const getTitleActivity = vi.fn(async () => activity)
        const server = await createServer(getTitleActivity)
        try {
            const response = await server.inject('/activity/known')
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ status: 'ok', payload: { activity } })
            expect(getTitleActivity).toHaveBeenCalledWith('known')
        } finally {
            await server.close()
        }
    })

    it('reads nothing for an unknown title', async () => {
        const getTitleActivity = vi.fn(async () => ({ inProgress: [], recentlyFinished: [] }))
        const server = await createServer(getTitleActivity)
        try {
            expect((await server.inject('/activity/unknown')).statusCode).toBe(404)
            expect(getTitleActivity).not.toHaveBeenCalled()
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
            const response = await server.inject('/activity/known')
            expect(response.statusCode).toBe(503)
            expect(response.json().error.name).toBe('TitleActivityUnavailable')
        } finally {
            await server.close()
        }
    })
})
