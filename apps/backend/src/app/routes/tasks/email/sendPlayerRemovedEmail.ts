import { FastifyInstance } from 'fastify'
import { GameStatus, UserStatus } from '@tabletop/common'
import {
    PlayerRemovedEmailTask,
    emailRecipient,
    removedPlayerDisplayName
} from '@tabletop/backend-services'

import { emailRecipientAccount } from '../../../lib/emailRecipientAccount.js'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: PlayerRemovedEmailTask }>(
        '/sendPlayerRemovedEmail',
        { schema: { body: PlayerRemovedEmailTask } },
        async function (request, reply) {
            const { removedUserId, gameId, toEmail, recipientId } = request.body
            const [game, removed, recipient] = await Promise.all([
                fastify.gameService.getGame({ gameId }),
                fastify.userService.getUser(removedUserId),
                emailRecipientAccount(fastify.userService, { userId: recipientId, email: toEmail })
            ])
            const seat = game?.players.find((player) => player.userId === removedUserId)
            const definition = game && fastify.gameService.getTitle(game.typeId)
            if (
                game?.status === GameStatus.Started &&
                seat &&
                definition &&
                (removed?.status === UserStatus.Inactive || removed?.status === UserStatus.Deleted)
            ) {
                const to = emailRecipient(toEmail, recipient)
                await fastify.emailService.sendPlayerRemovedEmail({
                    playerName: removedPlayerDisplayName(seat.name, to.locale),
                    game,
                    definition,
                    url: `${FRONTEND_HOST}/game/${gameId}`,
                    to,
                    deletedAccount: removed.status === UserStatus.Deleted
                })
            }
            await reply.code(200).send()
        }
    )
}
