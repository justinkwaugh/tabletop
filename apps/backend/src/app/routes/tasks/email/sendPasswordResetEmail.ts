import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

type SendPasswordResetEmailRequest = Static<typeof SendPasswordResetEmailRequest>
const SendPasswordResetEmailRequest = Type.Object(
    {
        userId: Type.String(),
        token: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SendPasswordResetEmailRequest }>(
        '/sendPasswordResetEmail',
        {
            schema: { body: SendPasswordResetEmailRequest }
        },
        async function (request, reply) {
            const { token } = request.body

            fastify.log.info(
                `Send Password Reset Email Task for user ${request.body.userId} with token ${request.body.token}`
            )
            const user = await fastify.userService.getUser(request.body.userId)
            if (!user || !user.email) {
                fastify.log.error(
                    `User ${request.body.userId} not found or missing email address, cannot send password reset email`
                )
                return
            }

            const url = `${FRONTEND_HOST}/email/passwordReset/${token}`
            await fastify.emailService.sendPasswordResetEmail(token, url, user.email)
            await reply.code(200).send()
        }
    )
}
