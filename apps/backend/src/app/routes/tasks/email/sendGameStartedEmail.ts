import { FastifyInstance } from 'fastify'
import { GameStatus } from '@tabletop/common'
import { GameEmailTask, emailRecipient, gameStartedSeats } from '@tabletop/backend-services'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: GameEmailTask }>(
        '/sendGameStartedEmail',
        { schema: { body: GameEmailTask } },
        async function (request, reply) {
            const { userId, gameId, toEmail } = request.body
            const game = await fastify.gameService.getGame({ gameId })
            if (game?.status !== GameStatus.Started) {
                fastify.log.info(`Game ${gameId} is not running, skipping game started email`)
                return reply.code(200).send()
            }
            const definition = fastify.gameService.getTitle(game.typeId)
            if (!definition) {
                fastify.log.error(
                    `Title ${game.typeId} not supported, cannot send game started email`
                )
                return reply.code(200).send()
            }
            const [turnNotificationsOn, recipient] = await Promise.all([
                fastify.notificationService.hasUserDirectSubscription(userId),
                fastify.userService.getUser(userId)
            ])
            await fastify.emailService.sendGameStartedEmail({
                title: definition.info.metadata.name,
                gameName: game.name,
                ...gameStartedSeats(game, userId),
                turnNotificationsOn,
                url: `${FRONTEND_HOST}/game/${gameId}`,
                notificationsUrl: `${FRONTEND_HOST}/notifications`,
                to: emailRecipient(toEmail, recipient)
            })
            return reply.code(200).send()
        }
    )
}
