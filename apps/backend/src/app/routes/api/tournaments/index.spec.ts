import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import secureSession from '@fastify/secure-session'
import { randomBytes } from 'node:crypto'
import { Role, UserStatus, type TournamentDraft, type User } from '@tabletop/common'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { TournamentError } from '@tabletop/backend-services'
import authorization from '../../../plugins/authorization.js'
import tournaments from './index.js'
import { authSession } from '../../../lib/session.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
afterAll(() => vi.unstubAllEnvs())

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup(roles: Role[]) {
    const server = Fastify()
    servers.push(server)
    const user: User = {
        id: 'account',
        username: 'Account',
        status: UserStatus.Active,
        roles,
        externalIds: []
    }
    await server.register(sensible)
    await server.register(secureSession, { key: randomBytes(32), cookie: { path: '/' } })
    Reflect.set(server, 'userService', { getUser: async () => user })
    const change = vi.fn(async () => ({ id: 'event' }))
    Reflect.set(server, 'tournamentService', {
        create: change,
        update: change,
        publish: change,
        cancel: change,
        lock: change,
        previewSchedule: change,
        commitSchedule: change
    })
    await server.register(authorization)
    await server.register(tournaments, { prefix: '/tournaments' })
    server.get('/session', async (request) => {
        authSession({ session: request.session, userId: user.id })
        request.session.set('authTimestamp', '2000-01-01T00:00:00.000Z')
        return {}
    })
    const response = await server.inject('/session')
    const cookie = response.cookies[0]
    return { server, user, change, cookies: { [cookie.name]: cookie.value } }
}

const draft: TournamentDraft = {
    name: 'Mini tournament',
    description: '',
    format: { kind: 'mini', stages: [{ id: 'main', name: 'Main stage', gamesPerEntrant: 4 }] },
    rules: {
        titleId: 'sol',
        tableSize: 4,
        registration: { kind: 'whenFull', capacity: 8 },
        concurrency: 2,
        gameConfig: {},
        scoring: 'splitWinsV1'
    }
}

describe('tournament administrator authorization', () => {
    it.each([true, false])(
        'uses the existing session, with administrator role %s',
        async (admin) => {
            const { server, cookies, change } = await setup(
                admin ? [Role.User, Role.Admin] : [Role.User]
            )
            const requests = [
                { method: 'POST', url: '/tournaments/', payload: { id: 'event', draft } },
                { method: 'PUT', url: '/tournaments/event', payload: { draft, revision: 1 } },
                {
                    method: 'POST',
                    url: '/tournaments/event/schedule/preview',
                    payload: { revision: 1, seed: 42, version: 1 }
                },
                {
                    method: 'POST',
                    url: '/tournaments/event/schedule',
                    payload: { revision: 1, seed: 42, version: 1, scheduleId: 'a'.repeat(64) }
                },
                ...['publish', 'cancel', 'lock'].map((operation) => ({
                    method: 'POST',
                    url: `/tournaments/event/${operation}`,
                    payload: {}
                }))
            ]
            for (const request of requests) {
                const response = await server.inject({
                    ...request,
                    cookies,
                    method: request.method === 'PUT' ? 'PUT' : 'POST'
                })
                expect(response.statusCode).toBe(admin ? 200 : 403)
            }
            expect(change).toHaveBeenCalledTimes(admin ? 7 : 0)
        }
    )
    it.each([
        { revision: 1, seed: -1, version: 1 },
        { revision: 1, seed: 42, version: 2 },
        { revision: 1, seed: 0x100000000, version: 1 }
    ])('rejects invalid schedule inputs before generation', async (payload) => {
        const { server, cookies, change } = await setup([Role.User, Role.Admin])
        const response = await server.inject({
            method: 'POST',
            url: '/tournaments/event/schedule/preview',
            cookies,
            payload
        })
        expect(response.statusCode).toBe(400)
        expect(change).not.toHaveBeenCalled()
    })
    it('rechecks the role when an administrator loses access', async () => {
        const { server, user, cookies, change } = await setup([Role.User, Role.Admin])
        user.roles = [Role.User]
        const response = await server.inject({
            method: 'POST',
            url: '/tournaments/event/publish',
            cookies,
            payload: {}
        })
        expect(response.statusCode).toBe(403)
        expect(change).not.toHaveBeenCalled()
    })
})

describe('tournament errors', () => {
    it.each([403, 404, 409])('uses the shared API error envelope for status %s', async (status) => {
        const { server, cookies, change } = await setup([Role.User, Role.Admin])
        change.mockRejectedValueOnce(new TournamentError('Tournament changed', status))
        const response = await server.inject({
            method: 'POST',
            url: '/tournaments/event/publish',
            cookies,
            payload: {}
        })
        expect(response.statusCode).toBe(status)
        expect(response.json()).toEqual({
            status: 'error',
            error: { name: 'TournamentError', message: 'Tournament changed' }
        })
    })
})
