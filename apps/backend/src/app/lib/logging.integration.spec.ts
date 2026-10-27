import Fastify, { type FastifyInstance } from 'fastify'
import { Firestore } from '@google-cloud/firestore'
import { randomUUID } from 'node:crypto'
import { inspect } from 'node:util'
import { ExternalAuthService } from '@tabletop/common'
import {
    FirestoreOAuthStateStore,
    FirestoreSessionStore,
    RedisCacheService,
    RedisService,
    secretReference,
    sessionCacheKey,
    type AuthenticatedSession,
    type OAuthStateRecord
} from '@tabletop/backend-services'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
})
import { apiErrorShape } from '../tests/accountFixture.js'
import { LoggingBoundary } from './logging.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'failing persistence through the logging boundary',
    () => {
        const firestore = new Firestore({
            projectId: 'demo-tabletop',
            databaseId: `test-${randomUUID()}`
        })
        let redis: RedisService
        let cache: RedisCacheService
        const servers = new Set<FastifyInstance>()
        const cacheKeys: string[] = []

        beforeAll(async () => {
            vi.stubEnv('REDIS_HOST', process.env.CACHE_TEST_REDIS_HOST ?? '')
            redis = await RedisService.createRedisService({ getSecret: async () => '' })
            cache = new RedisCacheService(redis)
        })
        afterEach(async () => {
            vi.restoreAllMocks()
            for (const server of servers) await server.close()
            servers.clear()
        })
        afterAll(async () => {
            if (cacheKeys.length) await redis.client.del(cacheKeys)
            cache.destroy()
            redis.destroy()
            await firestore.terminate()
        })

        function capturingServer() {
            const lines: string[] = []
            const consoleLines: string[] = []
            const record = (...args: unknown[]) => {
                consoleLines.push(inspect(args, { depth: 20 }))
            }
            vi.spyOn(console, 'log').mockImplementation(record)
            vi.spyOn(console, 'error').mockImplementation(record)
            const logging = new LoggingBoundary()
            const server = Fastify({
                logger: {
                    ...logging.loggerOptions,
                    stream: {
                        write: (line: string) => {
                            lines.push(line)
                        }
                    }
                }
            })
            logging.observeRoutes(server)
            apiErrorShape(server)
            servers.add(server)
            return {
                server,
                logged: () => lines.join(''),
                reported: () => consoleLines.join('\n')
            }
        }

        function newSession(): AuthenticatedSession {
            const createdAt = new Date('2026-10-27T12:00:00.000Z')
            const id = `SYNTHETIC-SESSION-${randomUUID()}`
            cacheKeys.push(sessionCacheKey(id))
            return {
                id,
                userId: 'account-1',
                generation: 0,
                createdAt,
                authenticatedAt: createdAt,
                expiresAt: new Date('2026-11-26T12:00:00.000Z')
            }
        }

        it('logs a refused duplicate session write without the Session ID anywhere', async () => {
            const { server, logged, reported } = capturingServer()
            const store = new FirestoreSessionStore(cache, firestore)
            const session = newSession()
            server.post('/sessions', async (request) => {
                try {
                    await store.create(session)
                } catch (error) {
                    request.log.error({ err: error }, 'Session write refused')
                    throw error
                }
                return {}
            })

            expect((await server.inject({ method: 'POST', url: '/sessions' })).statusCode).toBe(200)
            const refused = await server.inject({ method: 'POST', url: '/sessions' })

            expect(refused.statusCode).toBe(400)
            expect(refused.body).not.toContain(session.id)
            expect(logged()).toContain('Session write refused')
            expect(logged()).toContain('AlreadyExistsError')
            expect(logged()).toContain('ALREADY_EXISTS')
            expect(logged()).toContain(`"id":"${secretReference(session.id)}"`)
            expect(reported()).toContain('Cache write outcome is uncertain')
            expect(reported()).toContain("keyFamilies: [ 'session' ]")
            expect(logged()).not.toContain(session.id)
            expect(reported()).not.toContain(session.id)
        })

        it('reads through a malformed cached session without logging the Session ID', async () => {
            const { server, logged, reported } = capturingServer()
            const store = new FirestoreSessionStore(cache, firestore)
            const session = newSession()
            await store.create(session)
            await redis.client.set(sessionCacheKey(session.id), `V:{"id":"${session.id}"`)
            server.get('/sessions/current', async () => (await store.find(session.id)) ?? {})

            const response = await server.inject({ method: 'GET', url: '/sessions/current' })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toMatchObject({ id: session.id, userId: 'account-1' })
            expect(reported()).toContain('unable to parse cache value')
            expect(reported()).toContain("keyFamily: 'session'")
            expect(reported()).toContain("name: 'SyntaxError'")
            expect(logged()).not.toContain(session.id)
            expect(reported()).not.toContain(session.id)
        })

        it('logs a refused duplicate OAuth state without the Authorization State anywhere', async () => {
            const { server, logged, reported } = capturingServer()
            const store = new FirestoreOAuthStateStore(firestore)
            const record: OAuthStateRecord = {
                state: `link.SYNTHETIC-STATE-${randomUUID()}`,
                provider: ExternalAuthService.Discord,
                purpose: 'link',
                redirectUri: 'https://site.test/oauth/discord/link',
                binding: { kind: 'session', sessionId: 'session-1', userId: 'account-1' },
                expiresAt: new Date('2026-10-27T12:10:00.000Z')
            }
            server.post('/states', async (request) => {
                try {
                    await store.create(record)
                } catch (error) {
                    request.log.error({ err: error }, 'Authorization State write refused')
                    throw error
                }
                return {}
            })

            expect((await server.inject({ method: 'POST', url: '/states' })).statusCode).toBe(200)
            const refused = await server.inject({ method: 'POST', url: '/states' })

            expect(refused.statusCode).toBe(400)
            expect(refused.body).not.toContain(record.state)
            expect(logged()).toContain('Authorization State write refused')
            expect(logged()).toContain('AlreadyExistsError')
            expect(logged()).toContain(`"id":"${secretReference(record.state)}"`)
            expect(logged()).not.toContain(record.state)
            expect(reported()).not.toContain(record.state)
        })
    }
)
