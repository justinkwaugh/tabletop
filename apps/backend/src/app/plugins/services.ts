import {
    GameService,
    CloudTasksTaskService,
    EmailService,
    FirestoreTokenStore,
    FirestoreUserStore,
    LocalTaskService,
    TaskService,
    TokenService,
    UserService,
    SecretsService,
    EnvSecretsService,
    FirestoreGameStore,
    NotificationService,
    PubSubService,
    DiscordService,
    FirestoreNotificationStore,
    DefaultNotificationService,
    DiscordTransport,
    WebPushTransport,
    AblyTransport,
    AblyService,
    NullPubSubService,
    RedisPubSubService,
    RedisCacheService,
    RedisService,
    ChatService,
    FirestoreChatStore,
    ResendEmailService,
    PubSubTransport
} from '@tabletop/backend-services'

import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
    interface FastifyInstance {
        taskService: TaskService
        tokenService: TokenService
        userService: UserService
        emailService: EmailService
        secretsService: SecretsService
        gameService: GameService
        notificationService: NotificationService
        pubSubService: PubSubService
        discordService: DiscordService
        ablyService: AblyService
        chatService: ChatService
    }
}

const service: string = process.env['K_SERVICE'] ?? 'local'
const TASKS_HOST = process.env['TASKS_HOST'] ?? ''

const useAbly = !!process.env['ABLY_API_KEY']

export default fp(async (fastify: FastifyInstance) => {
    const secretsService = new EnvSecretsService()
    const emailService = await ResendEmailService.createEmailService(secretsService)
    const redisService = await RedisService.createRedisService(secretsService)
    const redisCacheService = new RedisCacheService(redisService)

    const taskService: TaskService =
        service === 'local'
            ? new LocalTaskService(TASKS_HOST)
            : new CloudTasksTaskService(TASKS_HOST)
    const tokenService = new TokenService(new FirestoreTokenStore(fastify.firestore))
    const userService = new UserService(
        new FirestoreUserStore(redisCacheService, fastify.firestore),
        tokenService,
        taskService
    )

    let pubSubService: PubSubService = new NullPubSubService()
    if (!useAbly) {
        pubSubService = await RedisPubSubService.createPubSubService(redisService)
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
        redisCacheService
    )

    const discordService = new DiscordService(notificationService, userService)

    if (process.env['DISCORD_BOT_TOKEN']) {
        const discordTransport = await DiscordTransport.createDiscordTransport(
            secretsService,
            gameService
        )
        notificationService.addTransport(discordTransport)
    }

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
    fastify.decorate('tokenService', tokenService)
    fastify.decorate('userService', userService)
    fastify.decorate('emailService', emailService)
    fastify.decorate('secretsService', secretsService)
    fastify.decorate('gameService', gameService)
    fastify.decorate('pubSubService', pubSubService)
    fastify.decorate('notificationService', notificationService)
    fastify.decorate('discordService', discordService)
    fastify.decorate('chatService', chatService)
})
