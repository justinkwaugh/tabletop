import path from 'node:path'
import {
    AblyService,
    AblyTransport,
    BugReportService,
    CatalogService,
    ChatService,
    CloudTasksTaskService,
    createLocalManifest,
    DefaultNotificationService,
    DiscordBotApi,
    DiscordService,
    DiscordTransport,
    EmailService,
    EnvSecretsService,
    EnvService,
    FirestoreChatStore,
    FirestoreGameStore,
    FirestoreNotificationStore,
    FirestorePreferenceStore,
    FirestoreTokenStore,
    FirestoreTournamentStore,
    FirestoreUserStore,
    GameService,
    LibraryService,
    LOCAL_WORKSPACE_ROOT,
    LocalTaskService,
    NotificationService,
    NullPubSubService,
    PreferenceService,
    PubSubService,
    PubSubTransport,
    RedisCacheService,
    RedisPubSubService,
    RedisService,
    ResendEmailService,
    SecretsService,
    STATIC_ROOT,
    TaskService,
    TokenService,
    TournamentService,
    UserService,
    WebPushTransport
} from '@tabletop/backend-services'
import type { GameDefinition } from '@tabletop/common'

import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
    interface FastifyInstance {
        taskService: TaskService
        tokenService: TokenService
        userService: UserService
        preferenceService: PreferenceService
        emailService: EmailService
        secretsService: SecretsService
        gameService: GameService
        notificationService: NotificationService
        pubSubService: PubSubService
        discordService: DiscordService
        ablyService: AblyService
        chatService: ChatService
        cacheService: RedisCacheService
        libraryService: LibraryService
        catalogService: CatalogService
        tournamentService: TournamentService
        bugReportService: BugReportService | undefined
    }
}

const service: string = process.env['K_SERVICE'] ?? 'local'
const TASKS_HOST = process.env['TASKS_HOST'] ?? ''
const SITE_MANIFEST_PATH =
    process.env['SITE_MANIFEST_PATH'] ?? path.join(STATIC_ROOT, 'config', 'site-manifest.json')

const useAbly = !!process.env['ABLY_API_KEY']
const BUG_REPORT_CHANNEL_ID = process.env['DISCORD_BUG_REPORT_CHANNEL_ID']

export default fp(async (fastify: FastifyInstance) => {
    const secretsService = new EnvSecretsService()
    const emailService = await ResendEmailService.createEmailService(secretsService)
    const redisService = await RedisService.createRedisService(secretsService)
    fastify.addHook('onClose', async () => redisService.destroy())
    const redisCacheService = new RedisCacheService(redisService)
    fastify.addHook('onClose', async () => redisCacheService.destroy())

    const libraryService = new LibraryService(redisCacheService, {
        manifestPath: SITE_MANIFEST_PATH,
        fallbackManifest: EnvService.isLocal()
            ? () => createLocalManifest(LOCAL_WORKSPACE_ROOT)
            : undefined,
        useCache: !EnvService.isLocal()
    })

    let availableTitles: Record<string, GameDefinition> = {}
    try {
        availableTitles = await libraryService.getTitlesMap()
    } catch (error) {
        console.warn('Unable to load game definitions from manifest', error)
    }

    const taskService: TaskService = EnvService.isLocal()
        ? new LocalTaskService(TASKS_HOST)
        : new CloudTasksTaskService(TASKS_HOST)
    const tokenService = new TokenService(new FirestoreTokenStore(fastify.firestore))
    const userService = new UserService(
        new FirestoreUserStore(redisCacheService, fastify.firestore, service === 'local'),
        tokenService,
        taskService
    )

    let pubSubService: PubSubService = new NullPubSubService()
    if (!useAbly) {
        const redisPubSubService = await RedisPubSubService.createPubSubService(redisService)
        fastify.addHook('onClose', async () => redisPubSubService.destroy())
        pubSubService = redisPubSubService
    }

    const notificationService = await DefaultNotificationService.createNotificationService(
        new FirestoreNotificationStore(redisCacheService, fastify.firestore),
        pubSubService
    )

    const gameService = new GameService(
        new FirestoreGameStore(redisCacheService, fastify.firestore),
        userService,
        tokenService,
        taskService,
        notificationService,
        redisCacheService,
        availableTitles
    )

    const catalogService = new CatalogService(path.join(STATIC_ROOT, 'games'))

    const discordBotApi = process.env['DISCORD_BOT_TOKEN']
        ? new DiscordBotApi(await secretsService.getSecret('DISCORD_BOT_TOKEN'))
        : undefined
    const discordTransport = discordBotApi
        ? new DiscordTransport(libraryService, catalogService, discordBotApi)
        : undefined
    if (discordTransport) {
        notificationService.addTransport(discordTransport)
    }

    const discordService = new DiscordService(notificationService, userService, discordTransport)

    const webPushTransport = await WebPushTransport.createWebPushTransport(secretsService)
    notificationService.addTransport(webPushTransport)

    if (useAbly) {
        const ablyTransport = await AblyTransport.createAblyTransport(secretsService)
        notificationService.addTopicTransport(ablyTransport)
        const ablyService = await AblyService.createAblyService(secretsService)
        fastify.decorate('ablyService', ablyService)
    } else {
        const pubSubTransport = new PubSubTransport(pubSubService)
        notificationService.addTopicTransport(pubSubTransport)
    }

    const chatService = new ChatService(
        gameService,
        new FirestoreChatStore(redisCacheService, fastify.firestore)
    )

    fastify.decorate('taskService', taskService)
    const tournamentService = new TournamentService(
        new FirestoreTournamentStore(redisCacheService, fastify.firestore),
        userService,
        availableTitles,
        notificationService,
        gameService,
        taskService
    )
    fastify.decorate('tournamentService', tournamentService)
    fastify.addHook('onClose', async () => {
        if (taskService instanceof LocalTaskService) taskService.close()
    })
    fastify.decorate('tokenService', tokenService)
    fastify.decorate('userService', userService)
    fastify.decorate(
        'preferenceService',
        new PreferenceService(new FirestorePreferenceStore(fastify.firestore), redisCacheService)
    )
    fastify.decorate('emailService', emailService)
    fastify.decorate('secretsService', secretsService)
    fastify.decorate('gameService', gameService)
    fastify.decorate('libraryService', libraryService)
    fastify.decorate('catalogService', catalogService)
    fastify.decorate('pubSubService', pubSubService)
    fastify.decorate('notificationService', notificationService)
    fastify.decorate('discordService', discordService)
    fastify.decorate('chatService', chatService)
    fastify.decorate('cacheService', redisCacheService)
    fastify.decorate(
        'bugReportService',
        discordBotApi && BUG_REPORT_CHANNEL_ID
            ? new BugReportService(gameService, userService, discordBotApi, {
                  forumChannelId: BUG_REPORT_CHANNEL_ID,
                  frontendHost: process.env['FRONTEND_HOST'] ?? ''
              })
            : undefined
    )
})
