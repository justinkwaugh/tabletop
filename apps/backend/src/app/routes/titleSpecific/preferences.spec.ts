import Fastify from 'fastify'
import fastifyAuth from '@fastify/auth'
import * as Type from 'typebox'
import {
    PreferenceError,
    Role,
    UserStatus,
    type GameDefinition,
    type User,
    type TitlePreferenceData
} from '@tabletop/common'
import { info, runtime } from '@tabletop/common/test-fixtures/private-hand'
import { afterEach, expect, it, vi } from 'vitest'
import preferencesRoute from './preferences.js'

const definition: GameDefinition = {
    info: {
        ...info,
        preferences: {
            title: {
                schema: Type.Object({ compact: Type.Boolean() }),
                version: 1,
                defaults: { compact: false }
            }
        }
    },
    runtime
}
const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()))
})
async function fixture(authenticated = true, title = definition) {
    const server = Fastify()
    servers.push(server)
    await server.register(fastifyAuth)
    const user: User = {
        id: 'alice',
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: []
    }
    Reflect.set(
        server,
        'verifyActiveUser',
        async (request: { user?: User }, reply: { code: (status: number) => unknown }) => {
            if (!authenticated) {
                reply.code(401)
                throw new Error('Unauthorized')
            }
            request.user = user
        }
    )
    Reflect.set(server, 'verifyRoleUser', async () => {})
    const data = { title: { version: 1, revision: 1, values: { compact: true } } }
    const read = vi.fn(
        async (): Promise<{ data?: TitlePreferenceData; etag: string }> => ({ data, etag: '"1"' })
    )
    const update = vi.fn(async () => ({ data, etag: '"2"' }))
    Reflect.set(server, 'preferenceService', { read, update })
    await server.register(preferencesRoute.bind(undefined, title))
    return { server, read, update }
}
it('scopes cacheable reads to the authenticated user, not the query account', async () => {
    const { server, read } = await fixture()
    const result = await server.inject('/preferences?account=bob')
    expect(result.statusCode).toBe(200)
    expect(result.headers.etag).toBe('"1"')
    expect(result.headers['cache-control']).toBe('private, no-cache')
    expect(result.headers.vary).toBe('Cookie')
    expect(read).toHaveBeenCalledWith(
        'alice',
        definition.info.id,
        definition.info.preferences,
        undefined
    )
})
it('requires authentication and conditional writes', async () => {
    const unauthorized = await fixture(false)
    expect((await unauthorized.server.inject('/preferences')).statusCode).toBe(401)
    expect(unauthorized.read).not.toHaveBeenCalled()
    const { server, update } = await fixture()
    const payload = { scope: 'title', version: 1, set: { compact: true }, unset: [] }
    expect(
        (await server.inject({ method: 'POST', url: '/updateTitlePreferences', payload })).statusCode
    ).toBe(428)
    expect(update).not.toHaveBeenCalled()
    const result = await server.inject({
        method: 'POST',
        url: '/updateTitlePreferences',
        headers: { 'if-match': '"1"' },
        payload
    })
    expect(result.statusCode).toBe(200)
    expect(result.headers.etag).toBe('"2"')
    expect(update).toHaveBeenCalledWith(
        'alice',
        definition.info.id,
        definition.info.preferences,
        payload,
        '"1"'
    )
})
it('preserves preference conflict statuses and rejects malformed update envelopes', async () => {
    const { server, update } = await fixture()
    update.mockRejectedValue(new PreferenceError('Changed', 412))
    const headers = { 'if-match': '"old"' }
    const payload = { scope: 'title', version: 1, set: {}, unset: [] }
    expect(
        (await server.inject({ method: 'POST', url: '/updateTitlePreferences', headers, payload })).statusCode
    ).toBe(412)
    expect(
        (
            await server.inject({
                method: 'POST',
                url: '/updateTitlePreferences',
                headers,
                payload: { ...payload, scope: 'another-user' }
            })
        ).statusCode
    ).toBe(400)
})
it('does not register preferences for an older title without a descriptor', async () => {
    const { server } = await fixture(true, { info, runtime })
    expect((await server.inject('/preferences')).statusCode).toBe(404)
})

it('returns an empty 304 response for a matching cached revision', async () => {
    const { server, read } = await fixture()
    read.mockResolvedValue({ etag: '"1"' })
    const result = await server.inject({ url: '/preferences', headers: { 'if-none-match': '"1"' } })
    expect(result.statusCode).toBe(304)
    expect(result.body).toBe('')
    expect(result.headers.etag).toBe('"1"')
})
