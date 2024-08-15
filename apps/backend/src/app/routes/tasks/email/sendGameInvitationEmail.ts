import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

type SendGameInvitationEmailRequest = Static<typeof SendGameInvitationEmailRequest>
const SendGameInvitationEmailRequest = Type.Object(
    {
        userId: Type.String(),
        gameId: Type.String(),
        token: Type.String(),
        toEmail: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SendGameInvitationEmailRequest }>(
        '/sendGameInvitationEmail',
        {
            schema: { body: SendGameInvitationEmailRequest }
        },
        async function (request, reply) {
            const { userId, gameId, token, toEmail } = request.body

            const owner = await fastify.userService.getUser(userId)
            if (!owner) {
                fastify.log.error(`User ${userId} not found, cannot send invitation email`)
                return
            }

            const game = await fastify.gameService.getGame({ gameId })
            if (!game) {
                fastify.log.error(`Game ${gameId} not found, cannot send invitation email`)
                return
            }

            const definition = fastify.gameService.getTitle(game.typeId)
            if (!definition) {
                fastify.log.error(
                    `Title ${game.typeId} not supported, cannot send invitation email`
                )
                return
            }

            const url = `${FRONTEND_HOST}/email/gameInvitation/${token}`
            await fastify.emailService.sendGameInvitationEmail({
                owner,
                game,
                definition,
                url,
                toEmail
            })

            await reply.code(200).send()
        }
    )
}
