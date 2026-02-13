import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

type SendGameEndEmailRequest = Static<typeof SendGameEndEmailRequest>
const SendGameEndEmailRequest = Type.Object(
    {
        userId: Type.String(),
        gameId: Type.String(),
        toEmail: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SendGameEndEmailRequest }>(
        '/sendGameEndEmail',
        {
            schema: { body: SendGameEndEmailRequest }
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
                .filter((userId): userId is string => !!userId)

            const winners = await Promise.all(
                winnerUserIds.map(async (userId) => await fastify.userService.getUser(userId))
            )
            const validWinners = winners.filter((w) => w !== undefined)

            const url = `${FRONTEND_HOST}/game/${gameId}`
            await fastify.emailService.sendGameEndEmail({
                winners: validWinners,
                game,
                definition,
                url,
                toEmail
            })

            await reply.code(200).send()
        }
    )
}
