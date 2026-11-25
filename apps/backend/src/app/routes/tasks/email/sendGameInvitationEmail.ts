import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import type { User } from '@tabletop/common'
import { emailRecipient } from '@tabletop/backend-services'
import { emailRecipientAccount } from '../../../lib/emailRecipientAccount.js'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

type SendGameInvitationEmailRequest = Static<typeof SendGameInvitationEmailRequest>
const SendGameInvitationEmailRequest = Type.Object(
    {
        userId: Type.String(),
        gameId: Type.String(),
        token: Type.String(),
        toEmail: Type.String(),
        inviteeId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    // The invitation matters more than its language, so a failed lookup sends it in English.
    async function invitee({
        inviteeId,
        toEmail
    }: SendGameInvitationEmailRequest): Promise<User | undefined> {
        try {
            return await emailRecipientAccount(fastify.userService, {
                userId: inviteeId,
                email: toEmail
            })
        } catch (error) {
            fastify.log.error(
                { err: error, inviteeId },
                'Could not look up the invitee, sending the invitation in English'
            )
            return undefined
        }
    }

    fastify.post<{ Body: SendGameInvitationEmailRequest }>(
        '/sendGameInvitationEmail',
        {
            schema: { body: SendGameInvitationEmailRequest }
        },
        async function (request, reply) {
            const { userId, gameId, token, toEmail } = request.body

            const [owner, account] = await Promise.all([
                fastify.userService.getUser(userId),
                invitee(request.body)
            ])
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
                to: emailRecipient(toEmail, account)
            })

            await reply.code(200).send()
        }
    )
}
