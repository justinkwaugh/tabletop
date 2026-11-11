import { FastifyInstance } from 'fastify'
import { GameStatus, UserStatus } from '@tabletop/common'
import { PlayerRemovedEmailTask, removedPlayerDisplayName } from '@tabletop/backend-services'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: PlayerRemovedEmailTask }>(
        '/sendPlayerRemovedEmail',
        { schema: { body: PlayerRemovedEmailTask } },
        async function (request, reply) {
            const { removedUserId, gameId, toEmail } = request.body
            const [game, removed] = await Promise.all([
                fastify.gameService.getGame({ gameId }),
                fastify.userService.getUser(removedUserId)
            ])
            const seat = game?.players.find((player) => player.userId === removedUserId)
            const definition = game && fastify.gameService.getTitle(game.typeId)
            if (
                game?.status === GameStatus.Started &&
                seat &&
                definition &&
                removed?.status === UserStatus.Inactive
            ) {
                await fastify.emailService.sendPlayerRemovedEmail({
                    playerName: removedPlayerDisplayName(seat.name),
                    game,
                    definition,
                    url: `${FRONTEND_HOST}/game/${gameId}`,
                    toEmail
                })
            }
            await reply.code(200).send()
        }
    )
}
