import path from 'node:path'
import { cloudManifestReader } from '../../runtime/cloudManifest.js'
import {
    AblyService,
    AblyTransport,
    BugReportService,
    LobbyPostQueue,
    LobbyPosts,
    parseLobbyChannels,
    PostedLobbies,
    CatalogService,
    CharityTallyRefresher,
    CharityTallyService,
    ChatService,
    CloudTasksTaskService,
    createLocalManifest,
    DefaultNotificationService,
    DiscordBotApi,
    DiscordService,
    DiscordTransport,
    DiscordWebhookApi,
    DiscordWebhookService,
    DiscordWebhookTransport,
    TelegramBotApi,
    TelegramService,
    TelegramTransport,
    TopicRegistrationsService,
    EmailService,
    EnvSecretsService,
    EnvService,
    FirestoreCharityTallyStore,
    FirestoreLobbyPostStore,
    FirestoreChatStore,
    FirestoreGameStore,
    FirestoreGameFollowStore,
    GameFollowService,
    FirestoreNotificationStore,
    FirestorePreferenceStore,
    FirestoreSessionStore,
    FirestoreTokenStore,
    FirestoreTournamentStore,
    FirestoreLeagueStore,
    FirestoreSiteStatsStore,
    FirestoreUserStore,
    GameService,
    ProjectedHistoryCache,
    ActivityCache,
    SeriesActivityScope,
    TitleActivityScope,
    LibraryService,
    type LibraryServiceOptions,
    TitleLibrary,
    LOCAL_WORKSPACE_ROOT,
    LocalTaskService,
    NotificationService,
    NullPubSubService,
    PreferenceService,
    PubSubService,
    PubSubTransport,
    parseRealtimeSigningKey,
    RealtimeTokenIssuer,
    RedisCacheService,
    RedisRateLimitCounter,
    type RateLimitCounter,
    RedisPublisher,
    RedisPubSubService,
    RedisService,
    ResendEmailService,
    SecretsService,
    SessionService,
    DiscordOAuth,
    DiscordOAuthClient,
    StalledGames,
    AccountModeration,
    AbandonedSignUps,
    ContentReports,
    STATIC_ROOT,
    TaskService,
    TiltifyApi,
    TokenService,
    TournamentService,
    TournamentStallAlerts,
    LeagueService,
    SiteStatsService,
    UserService,
    WebPushTransport
} from '@tabletop/backend-services'
import { GameClientCapability } from '@tabletop/common'
import { TitleValidation } from '../../runtime/titleValidation.js'
import { publishedUiSupports } from '../lib/publishedUi.js'

import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
    interface FastifyInstance {
        taskService: TaskService
        tokenService: TokenService
        sessionService: SessionService
        discordOAuth: DiscordOAuth
        userService: UserService
        preferenceService: PreferenceService
        emailService: EmailService
        secretsService: SecretsService
        gameService: GameService
        gameFollowService: GameFollowService
        notificationService: NotificationService
        discordService: DiscordService
        telegramService: TelegramService
        discordWebhookService: DiscordWebhookService
        topicRegistrationsService: TopicRegistrationsService
        ablyService: AblyService | undefined
        ssePubSub: PubSubService | undefined
        chatService: ChatService
        cacheService: RedisCacheService
        rateLimitCounter: RateLimitCounter
        libraryService: LibraryService
        titleValidation: TitleValidation
        catalogService: CatalogService
        tournamentService: TournamentService
        tournamentStallAlerts: TournamentStallAlerts
        stalledGames: StalledGames
        accountModeration: AccountModeration
        abandonedSignUps: AbandonedSignUps
        leagueService: LeagueService
        siteStatsService: SiteStatsService
        bugReportService: BugReportService | undefined
        lobbyPosts: LobbyPosts | undefined
        contentReports: ContentReports | undefined
        realtimeTokenIssuer: RealtimeTokenIssuer | undefined
        charityTallyService: CharityTallyService
        charityTallyRefresher: CharityTallyRefresher | undefined
    }
}

const service: string = process.env['K_SERVICE'] ?? 'local'
const TASKS_HOST = process.env['TASKS_HOST'] ?? ''
const FRONTEND_HOST = process.env['FRONTEND_HOST'] ?? ''
const SITE_MANIFEST_PATH =
    process.env['SITE_MANIFEST_PATH'] ?? path.join(STATIC_ROOT, 'config', 'site-manifest.json')

const useAbly = !!process.env['ABLY_API_KEY']
const useRealtimeRelay = !!process.env['REALTIME_SIGNING_KEY']
const useSseRealtime = process.env['ENABLE_SSE_REALTIME'] === 'true'
const BUG_REPORT_CHANNEL_ID = process.env['DISCORD_BUG_REPORT_CHANNEL_ID']
const BUG_REPORT_DATA_CHANNEL_ID = process.env['DISCORD_BUG_REPORT_DATA_CHANNEL_ID']
const LOBBY_CHANNELS = parseLobbyChannels(process.env['DISCORD_LOBBY_CHANNELS'])
const useLobbyPosts = !!process.env['DISCORD_BOT_TOKEN'] && Object.keys(LOBBY_CHANNELS).length > 0
const MODERATION_EMAIL = process.env['MODERATION_EMAIL']
const useCharityTally = !!process.env['TILTIFY_CLIENT_ID']
const useTelegram = !!process.env['TELEGRAM_BOT_TOKEN']

type ServicesOptions = Pick<LibraryServiceOptions, 'whileLoadingTitle' | 'afterTitleLoads'>

export default fp(async (fastify: FastifyInstance, options: ServicesOptions) => {
    const secretsService = new EnvSecretsService()
    const emailService = await ResendEmailService.createEmailService(secretsService)
    const redisService = await RedisService.createRedisService(secretsService)
    fastify.addHook('onClose', async () => redisService.destroy())
    const redisCacheService = new RedisCacheService(redisService)
    fastify.addHook('onClose', async () => redisCacheService.destroy())

    const titleValidation = new TitleValidation()
    const libraryService = new LibraryService(redisCacheService, {
        manifestPath: SITE_MANIFEST_PATH,
        readManifest: EnvService.isLocal()
            ? undefined
            : cloudManifestReader(process.env['SITE_MANIFEST_GCS_URI']),
        fallbackManifest: EnvService.isLocal()
            ? () => createLocalManifest(LOCAL_WORKSPACE_ROOT)
            : undefined,
        useCache: !EnvService.isLocal(),
        whileLoadingTitle: options.whileLoadingTitle,
        afterTitleLoads: options.afterTitleLoads
    })
    await libraryService.getTitlesMap()
    const availableTitles = new TitleLibrary(
        (id) => libraryService.getGeneration(id)?.definition,
        () => libraryService.currentTitles()
    )
    fastify.decorate('titleValidation', titleValidation)

    const taskService: TaskService = EnvService.isLocal()
        ? new LocalTaskService(TASKS_HOST)
        : new CloudTasksTaskService(TASKS_HOST)
    const tokenService = new TokenService(new FirestoreTokenStore(fastify.firestore))
    const userStore = new FirestoreUserStore(
        redisCacheService,
        fastify.firestore,
        service === 'local'
    )
    const sessionService = new SessionService(
        new FirestoreSessionStore(redisCacheService, fastify.firestore)
    )
    const userService = new UserService(userStore, tokenService, taskService)
    const discordOAuth = new DiscordOAuthClient({
        clientId: process.env['DISCORD_CLIENT_ID'] ?? '',
        clientSecret: () => secretsService.getSecret('DISCORD_SECRET')
    })

    let ssePubSub: PubSubService | undefined
    if (useSseRealtime) {
        const redisPubSubService = await RedisPubSubService.createPubSubService(redisService)
        fastify.addHook('onClose', async () => redisPubSubService.destroy())
        ssePubSub = redisPubSubService
    }

    const notificationStore = new FirestoreNotificationStore(redisCacheService, fastify.firestore)
    const notificationService = await DefaultNotificationService.createNotificationService(
        notificationStore,
        ssePubSub ?? new NullPubSubService()
    )

    const postedLobbies = new PostedLobbies(
        LOBBY_CHANNELS,
        (titleId) => availableTitles.get(titleId)?.info.metadata
    )
    const lobbyPostQueue = useLobbyPosts
        ? new LobbyPostQueue(taskService, postedLobbies)
        : undefined
    const gameStore = new FirestoreGameStore(redisCacheService, fastify.firestore, {
        titleActivity: new ActivityCache(redisService.client, TitleActivityScope),
        seriesActivity: new ActivityCache(redisService.client, SeriesActivityScope),
        gameChanges: lobbyPostQueue
    })
    const gameFollowStore = new FirestoreGameFollowStore(redisCacheService, fastify.firestore)
    const gameService = new GameService(
        gameStore,
        userService,
        tokenService,
        taskService,
        notificationService,
        redisCacheService,
        availableTitles,
        gameFollowStore,
        new ProjectedHistoryCache(redisService.client)
    )
    fastify.decorate('gameFollowService', new GameFollowService(gameStore, gameFollowStore))

    fastify.decorate(
        'siteStatsService',
        new SiteStatsService(
            { games: gameStore, users: userStore, subscriptions: notificationStore },
            new FirestoreSiteStatsStore(fastify.firestore),
            taskService,
            redisCacheService
        )
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

    const discordService = new DiscordService(
        notificationService,
        userService,
        discordTransport,
        notificationStore
    )

    const telegramBot = useTelegram
        ? {
              api: new TelegramBotApi(await secretsService.getSecret('TELEGRAM_BOT_TOKEN')),
              webhookSecret: await secretsService.getSecret('TELEGRAM_WEBHOOK_SECRET')
          }
        : undefined
    if (telegramBot) {
        notificationService.addTransport(
            new TelegramTransport(
                { library: libraryService, catalog: catalogService },
                telegramBot.api,
                FRONTEND_HOST
            )
        )
    }
    const telegramService = new TelegramService(
        {
            notifications: notificationService,
            subscriptions: notificationStore,
            users: userService,
            linkTokens: redisCacheService
        },
        telegramBot,
        FRONTEND_HOST
    )

    const discordWebhookApi = new DiscordWebhookApi()
    notificationService.addTransport(
        new DiscordWebhookTransport(
            { library: libraryService, catalog: catalogService },
            discordWebhookApi,
            userService,
            FRONTEND_HOST
        )
    )
    const discordWebhookService = new DiscordWebhookService(
        {
            notifications: notificationService,
            subscriptions: notificationStore,
            users: userService,
            webhooks: discordWebhookApi
        },
        FRONTEND_HOST
    )

    const webPushTransport = await WebPushTransport.createWebPushTransport(secretsService)
    notificationService.addTransport(webPushTransport)

    let ablyService: AblyService | undefined
    if (useAbly) {
        const ablyTransport = await AblyTransport.createAblyTransport(secretsService)
        notificationService.addTopicTransport(ablyTransport)
        ablyService = await AblyService.createAblyService(secretsService)
    }
    fastify.decorate('ablyService', ablyService)
    fastify.decorate('ssePubSub', ssePubSub)
    if (useRealtimeRelay || useSseRealtime) {
        notificationService.addTopicTransport(new PubSubTransport(new RedisPublisher(redisService)))
    }
    fastify.decorate(
        'realtimeTokenIssuer',
        useRealtimeRelay
            ? new RealtimeTokenIssuer(
                  parseRealtimeSigningKey(await secretsService.getSecret('REALTIME_SIGNING_KEY'))
              )
            : undefined
    )

    const chatService = new ChatService(
        gameService,
        new FirestoreChatStore(redisCacheService, fastify.firestore)
    )

    fastify.decorate('taskService', taskService)
    const tournamentStore = new FirestoreTournamentStore(redisCacheService, fastify.firestore)
    const tournamentService = new TournamentService(
        tournamentStore,
        userService,
        availableTitles,
        notificationService,
        gameService,
        taskService
    )
    fastify.decorate('tournamentService', tournamentService)
    const titleSupportsCalls = (titleId: string) =>
        publishedUiSupports(
            { libraryService, catalogService },
            titleId,
            GameClientCapability.CalledGames
        )
    fastify.decorate(
        'stalledGames',
        new StalledGames(gameStore, gameService, taskService, titleSupportsCalls)
    )
    const accountDeletion = {
        sessions: sessionService,
        tokens: tokenService,
        preferences: userStore,
        follows: gameFollowStore,
        subscriptions: notificationStore
    }
    fastify.decorate(
        'accountModeration',
        new AccountModeration(
            userService,
            gameService,
            taskService,
            new RedisPublisher(redisService),
            titleSupportsCalls,
            accountDeletion
        )
    )
    fastify.decorate(
        'abandonedSignUps',
        new AbandonedSignUps(userStore, gameStore, taskService, accountDeletion)
    )
    fastify.decorate(
        'tournamentStallAlerts',
        new TournamentStallAlerts(
            gameStore,
            tournamentStore,
            userService,
            redisCacheService,
            taskService,
            discordTransport,
            FRONTEND_HOST
        )
    )
    fastify.decorate(
        'leagueService',
        new LeagueService(
            new FirestoreLeagueStore(redisCacheService, fastify.firestore),
            tournamentService,
            userService,
            taskService,
            notificationService
        )
    )
    fastify.addHook('onClose', async () => {
        if (taskService instanceof LocalTaskService) taskService.close()
    })
    fastify.decorate('tokenService', tokenService)
    fastify.decorate('sessionService', sessionService)
    fastify.decorate('discordOAuth', discordOAuth)
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
    fastify.decorate('notificationService', notificationService)
    fastify.decorate('discordService', discordService)
    fastify.decorate('telegramService', telegramService)
    fastify.decorate('discordWebhookService', discordWebhookService)
    fastify.decorate(
        'topicRegistrationsService',
        new TopicRegistrationsService(notificationStore, {
            discordBot: discordService.isAvailable,
            telegram: telegramService.isAvailable
        })
    )
    fastify.decorate('chatService', chatService)
    fastify.decorate('cacheService', redisCacheService)
    fastify.decorate('rateLimitCounter', new RedisRateLimitCounter(redisService.client))
    const charityTallyStore = new FirestoreCharityTallyStore(fastify.firestore)
    fastify.decorate(
        'charityTallyService',
        new CharityTallyService(charityTallyStore, redisCacheService)
    )
    fastify.decorate(
        'charityTallyRefresher',
        useCharityTally
            ? new CharityTallyRefresher(
                  new TiltifyApi(
                      await secretsService.getSecret('TILTIFY_CLIENT_ID'),
                      await secretsService.getSecret('TILTIFY_CLIENT_SECRET')
                  ),
                  charityTallyStore,
                  redisCacheService
              )
            : undefined
    )
    fastify.decorate(
        'contentReports',
        MODERATION_EMAIL
            ? new ContentReports(
                  gameService,
                  chatService,
                  userService,
                  taskService,
                  MODERATION_EMAIL,
                  FRONTEND_HOST
              )
            : undefined
    )
    fastify.decorate(
        'lobbyPosts',
        discordBotApi && lobbyPostQueue
            ? new LobbyPosts(
                  gameService,
                  discordBotApi,
                  new FirestoreLobbyPostStore(fastify.firestore),
                  lobbyPostQueue,
                  postedLobbies,
                  FRONTEND_HOST
              )
            : undefined
    )
    fastify.decorate(
        'bugReportService',
        discordBotApi && BUG_REPORT_CHANNEL_ID && BUG_REPORT_DATA_CHANNEL_ID
            ? new BugReportService(gameService, userService, discordBotApi, {
                  forumChannelId: BUG_REPORT_CHANNEL_ID,
                  dataChannelId: BUG_REPORT_DATA_CHANNEL_ID,
                  frontendHost: FRONTEND_HOST
              })
            : undefined
    )
})
