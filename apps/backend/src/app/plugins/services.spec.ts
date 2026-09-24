import Fastify from 'fastify'
import { restartable } from '@fastify/restartable'
import { createServer, type Socket } from 'node:net'
import { once } from 'node:events'
import { expect, test, vi } from 'vitest'
import type { RedisService as RedisServiceType } from '@tabletop/backend-services'

vi.mock('@tabletop/backend-services', async () => {
    const { RedisService } =
        await import('../../../../../libs/backend-services/src/redis/redisService.js')
    const { RedisPubSubService } =
        await import('../../../../../libs/backend-services/src/pubsub/redisPubSubService.js')
    const { RedisCacheService } =
        await import('../../../../../libs/backend-services/src/cache/cacheService.js')
    class Empty {}
    return {
        ...Object.fromEntries(
            [
                'CatalogService',
                'ChatService',
                'CloudTasksTaskService',
                'DiscordService',
                'FirestoreChatStore',
                'FirestoreGameStore',
                'FirestoreNotificationStore',
                'FirestorePreferenceStore',
                'FirestoreTokenStore',
                'FirestoreTournamentStore',
                'FirestoreUserStore',
                'GameService',
                'NullPubSubService',
                'PreferenceService',
                'PubSubTransport',
                'TokenService',
                'TournamentService',
                'UserService',
                'DiscordTransport'
            ].map((name) => [name, Empty])
        ),
        LocalTaskService: class {
            close() {}
        },
        RedisService,
        RedisPubSubService,
        RedisCacheService,
        LOCAL_WORKSPACE_ROOT: process.cwd(),
        createLocalManifest: vi.fn(),
        EnvService: { isLocal: () => false },
        EnvSecretsService: class {
            async getSecret() {
                return undefined
            }
        },
        ResendEmailService: { createEmailService: async () => ({}) },
        LibraryService: class {
            async getTitlesMap() {
                return {}
            }
        },
        DefaultNotificationService: {
            createNotificationService: async () => ({
                addTransport() {},
                addTopicTransport() {}
            })
        },
        WebPushTransport: { createWebPushTransport: async () => ({}) },
        AblyTransport: { createAblyTransport: async () => ({}) },
        AblyService: { createAblyService: async () => ({}) }
    }
})

test.each([true, false])(
    'restarts release Redis clients and pools with Ably=%s',
    async (useAbly) => {
        vi.resetModules()
        const sockets = new Set<Socket>()
        const redis = createServer((socket) => {
            sockets.add(socket)
            socket.on('close', () => sockets.delete(socket))
            socket.on('data', (data) => {
                const commands = data.toString().match(/^\*\d+\r$/gm) ?? []
                socket.write('+OK\r\n'.repeat(commands.length))
            })
        })
        redis.listen(0, '127.0.0.1')
        await once(redis, 'listening')
        const address = redis.address()
        if (!address || typeof address === 'string') throw new Error('TCP address required')
        vi.stubEnv('REDIS_HOST', '127.0.0.1')
        vi.stubEnv('REDIS_PORT', String(address.port))
        vi.stubEnv('K_SERVICE', 'backend')
        vi.stubEnv('ABLY_API_KEY', useAbly ? 'local-test' : '')
        const { RedisService, RedisPubSubService } = await import('@tabletop/backend-services')
        const pools: ReturnType<RedisServiceType['client']['createPool']>[] = []
        const createRedisService = RedisService.createRedisService.bind(RedisService)
        const created = vi
            .spyOn(RedisService, 'createRedisService')
            .mockImplementation(async (secrets) => {
                const redisService = await createRedisService(secrets)
                const createPool = redisService.client.createPool.bind(redisService.client)
                vi.spyOn(redisService.client, 'createPool').mockImplementation((...args) => {
                    const pool = createPool(...args)
                    pools.push(pool)
                    return pool
                })
                return redisService
            })
        const subscriptions = vi.spyOn(RedisPubSubService, 'createPubSubService')
        const { default: services } = await import('./services.js')
        const app = await restartable(
            async (factory) => {
                const app = factory()
                await app.register(services)
                await app.ready()
                for (const pool of pools.slice(-2)) {
                    await pool.execute(async (client) => {
                        if (!client.isOpen) await client.connect()
                    })
                }
                return app
            },
            {},
            Fastify
        )
        try {
            const expectedConnections = useAbly ? 3 : 4
            await vi.waitFor(() => expect(sockets.size).toBe(expectedConnections))
            for (let i = 0; i < 3; i++) {
                await app.restart()
                await vi.waitFor(() => expect(sockets.size).toBe(expectedConnections))
            }
            await app.close()
            await vi.waitFor(() => expect(sockets.size).toBe(0))
        } finally {
            for (const pool of pools) pool.destroy()
            for (const result of subscriptions.mock.results) (await result.value).destroy()
            for (const result of created.mock.results) {
                const service = await result.value
                if (service.client.isOpen) service.client.destroy()
            }
            for (const socket of sockets) socket.destroy()
            await new Promise<void>((resolve) => redis.close(() => resolve()))
            vi.restoreAllMocks()
            vi.unstubAllEnvs()
        }
    }
)
