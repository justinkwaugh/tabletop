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
    // RedisPubSubService,
    RedisCacheService,
    RedisService,
    ChatService,
    FirestoreChatStore
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

export default fp(async (fastify: FastifyInstance) => {
    const taskService: TaskService =
        service === 'local'
            ? new LocalTaskService(TASKS_HOST)
            : new CloudTasksTaskService(TASKS_HOST)
    const tokenService = new TokenService(new FirestoreTokenStore(fastify.firestore))
    const userService = new UserService(
        new FirestoreUserStore(fastify.firestore),
        tokenService,
        taskService
    )

    const secretsService = new EnvSecretsService()
    const emailService = await EmailService.createEmailService(secretsService)
    const redisService = await RedisService.createRedisService(secretsService)
    const redisCacheService = new RedisCacheService(redisService)
    // const pubSubService = await RedisPubSubService.createRedisPubSubService(secretsService)
    const pubSubService = new NullPubSubService() // While using Ably we do not need a pub sub service

    const notificationService = await DefaultNotificationService.createNotificationService(
        new FirestoreNotificationStore(fastify.firestore),
        pubSubService
    )

    const gameService = new GameService(
        new FirestoreGameStore(redisCacheService, fastify.firestore),
        userService,
        tokenService,
        taskService,
        notificationService
    )

    const discordService = new DiscordService(notificationService, userService)

    // const pubSubTransport = new PubSubTransport(pubSubService)
    const ablyTransport = await AblyTransport.createAblyTransport(secretsService)

    const discordTransport = await DiscordTransport.createDiscordTransport(
        secretsService,
        gameService
    )
    const webPushTransport = await WebPushTransport.createWebPushTransport(secretsService)

    notificationService.addTransport(discordTransport)
    notificationService.addTransport(webPushTransport)

    // notificationService.addTopicTransport(pubSubTransport)
    notificationService.addTopicTransport(ablyTransport)

    const ablyService = await AblyService.createAblyService(secretsService)

    const chatService = new ChatService(new FirestoreChatStore(fastify.firestore))

    fastify.decorate('taskService', taskService)
    fastify.decorate('tokenService', tokenService)
    fastify.decorate('userService', userService)
    fastify.decorate('emailService', emailService)
    fastify.decorate('secretsService', secretsService)
    fastify.decorate('gameService', gameService)
    fastify.decorate('pubSubService', pubSubService)
    fastify.decorate('notificationService', notificationService)
    fastify.decorate('discordService', discordService)
    fastify.decorate('ablyService', ablyService)
    fastify.decorate('chatService', chatService)
})
