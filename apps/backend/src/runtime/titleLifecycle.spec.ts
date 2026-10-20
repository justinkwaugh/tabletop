import Fastify from 'fastify'
import auth from '@fastify/auth'
import { afterEach, expect, it, vi } from 'vitest'
import {
    ActionSource,
    type GameAction,
    Role,
    UserStatus,
    type GameDefinition,
    type User
} from '@tabletop/common'
import { LibraryService } from '../../../../libs/backend-services/src/games/libraryService.js'
import { RedisCacheService } from '../../../../libs/backend-services/src/cache/cacheService.js'
import { logicPublicationFixture } from '../../../../libs/backend-services/src/games/tests/logicPublicationFixture.js'
import games from '../app/plugins/games.js'
import { installTitleScope } from './titleScope.js'
import { installManifestRefresh } from './manifestRefresh.js'
import { TitleValidation } from './titleValidation.js'
import { errorStatusCode } from '../app/lib/errorStatusCode.js'

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

it('changes actions and AJV schemas without rebuilding routes, while pinning in-flight responses', async () => {
    const f = await logicPublicationFixture()
    cleanups.push(f.close)
    await f.artifact('1.0.0', 'cjs', ['old'])
    await f.artifact('1.1.0', 'cjs', ['next'])
    await f.publish(f.manifest('1.0.0'))
    const validation = new TitleValidation()
    const library = new LibraryService(RedisCacheService.prototype, {
        useCache: false,
        manifestPath: f.manifestPath,
        logicRoot: f.directory,
        prepare: (generation) => validation.prepare(generation)
    })
    await library.getTitlesMap()
    const server = Fastify()
    cleanups.push(() => server.close())
    server.setErrorHandler((error, _request, reply) =>
        reply.code(errorStatusCode(error)).send({ message: error.message, code: error.code })
    )
    server.decorate('libraryService', library)
    server.decorate('titleValidation', validation)
    await server.register(auth)
    const user: User = {
        id: 'user',
        roles: [Role.User],
        status: UserStatus.Active,
        externalIds: []
    }
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => {})
    Reflect.set(server, 'verifyUser', async () => {})
    const entered = Promise.withResolvers<void>()
    const finish = Promise.withResolvers<void>()
    cleanups.push(async () => {
        finish.resolve()
    })
    const apply = vi.fn(
        async ({ definition, action }: { definition: GameDefinition; action: GameAction }) => {
            if (action.type === 'old') {
                entered.resolve()
                await finish.promise
                expect((await library.getTitle(f.titleId))?.info.metadata.version).toBe('1.0.0')
            }
            return { version: definition.info.metadata.version, action }
        }
    )
    Reflect.set(server, 'gameService', { getGame: async () => undefined, applyActionToGame: apply })
    installTitleScope(server)
    await server.register(games, { prefix: '/api/v1' })
    await server.ready()
    const post = (type: string, count: unknown = '2') =>
        server.inject({
            method: 'POST',
            url: `/api/v1/game/${f.titleId}/action/${type}`,
            payload: {
                gameId: 'game',
                action: { id: 'action', gameId: 'game', source: ActionSource.User, type, count }
            }
        })
    const pending = post('old').then((response) => response)
    await Promise.race([
        entered.promise,
        pending.then((response) => {
            throw new Error(response.body)
        })
    ])
    await f.publish(f.manifest('1.1.0'))
    await library.refreshAndActivate()
    expect((await post('old')).statusCode).toBe(404)
    const rejected = await post('next', 0)
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json().code).toBe('FST_ERR_VALIDATION')
    const next = await post('next')
    expect(next.statusCode).toBe(200)
    expect(next.json().payload.action.count).toBe(2)
    expect(next.headers['x-tabletop-game-logic-version']).toBe('1.1.0')
    finish.resolve()
    const old = await pending
    expect(old.statusCode).toBe(200)
    expect(old.headers['x-tabletop-game-logic-version']).toBe('1.0.0')
    expect(old.headers['x-tabletop-game-ui-version']).toBe('1.0.0')
    expect(apply).toHaveBeenCalledTimes(2)
})

it('preserves callback-based responses while tracking the request lifetime', async () => {
    const server = Fastify()
    cleanups.push(() => server.close())
    const library = new LibraryService(RedisCacheService.prototype)
    const release = vi.spyOn(library, 'releaseScope')
    server.decorate('libraryService', library)
    installTitleScope(server)
    server.get('/callback', (_request, reply) => {
        setImmediate(() => {
            expect(release).not.toHaveBeenCalled()
            reply.send({ completed: true })
        })
    })
    const response = await server.inject('/callback')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ completed: true })
    expect(release).toHaveBeenCalled()
})

async function refreshingServer(gate?: PromiseWithResolvers<void>, fail = false) {
    const f = await logicPublicationFixture()
    cleanups.push(f.close)
    await f.artifact('1.0.0')
    await f.artifact('1.1.0')
    await f.publish(f.manifest('1.0.0'))
    const validation = new TitleValidation()
    const library = new LibraryService(RedisCacheService.prototype, {
        useCache: false,
        manifestPath: f.manifestPath,
        logicRoot: f.directory,
        prepare: async (generation) => {
            await validation.prepare(generation)
            if (generation.publication.logicVersion !== '1.1.0') return
            if (fail) throw new Error('Invalid validator')
            await gate?.promise
        }
    })
    await library.getTitlesMap()
    const server = Fastify()
    cleanups.push(() => server.close())
    server.decorate('libraryService', library)
    installManifestRefresh(server, ['/api'])
    const version = async () => ({
        version: library.getGeneration(f.titleId)?.definition.info.metadata.version
    })
    server.get('/api/version', version)
    server.get('/other', version)
    await server.ready()
    return { f, server }
}

it('a request arriving while an activation is pending waits for it and runs the new logic', async () => {
    const gate = Promise.withResolvers<void>()
    const { f, server } = await refreshingServer(gate)
    expect((await server.inject('/api/version')).json().version).toBe('1.0.0')
    await f.publish(f.manifest('1.1.0'))
    const waiting = server.inject('/api/version')
    const later = server.inject('/api/version')
    await new Promise((resolve) => setTimeout(resolve, 50))
    // Paths outside the API do not refresh and still see the loaded titles meanwhile.
    expect((await server.inject('/other')).json().version).toBe('1.0.0')
    gate.resolve()
    expect((await waiting).json().version).toBe('1.1.0')
    expect((await later).json().version).toBe('1.1.0')
})

it('a request proceeds on the loaded titles when the activation it waited for fails', async () => {
    const { f, server } = await refreshingServer(undefined, true)
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    await f.publish(f.manifest('1.1.0'))
    const response = await server.inject('/api/version')
    expect(response.statusCode).toBe(200)
    expect(response.json().version).toBe('1.0.0')
    expect(reported).toHaveBeenCalledWith(
        expect.stringContaining('Title activation failed'),
        expect.any(Error)
    )
})
