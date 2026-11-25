import { FastifyInstance } from 'fastify'
import { GameEmailTask, emailRecipient } from '@tabletop/backend-services'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: GameEmailTask }>(
        '/sendGameEndEmail',
        {
            schema: { body: GameEmailTask }
        },
        async function (request, reply) {
            const { userId, gameId, toEmail } = request.body

            const game = await fastify.gameService.getGame({ gameId })
            if (!game) {
                fastify.log.error(`Game ${gameId} not found, cannot send game end email`)
                return
            }

            const definition = fastify.gameService.getTitle(game.typeId)
            if (!definition) {
                fastify.log.error(`Title ${game.typeId} not supported, cannot send game end email`)
                return
            }

            const playersById = new Map(game.players.map((player) => [player.id, player]))
            const winnerUserIds = game.winningPlayerIds
                .map((playerId) => playersById.get(playerId)?.userId)
                .filter((id): id is string => !!id)

            const [recipient, ...winners] = await Promise.all(
                [userId, ...winnerUserIds].map((id) => fastify.userService.getUser(id))
            )
            const validWinners = winners.filter((w) => w !== undefined)

            const url = `${FRONTEND_HOST}/game/${gameId}`
            await fastify.emailService.sendGameEndEmail({
                winners: validWinners,
                game,
                definition,
                url,
                to: emailRecipient(toEmail, recipient)
            })

            await reply.code(200).send()
        }
    )
}
