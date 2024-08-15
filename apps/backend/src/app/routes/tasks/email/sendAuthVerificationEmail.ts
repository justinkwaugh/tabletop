import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type SendAuthVerificationEmailRequest = Static<typeof SendAuthVerificationEmailRequest>
const SendAuthVerificationEmailRequest = Type.Object(
    {
        userId: Type.String(),
        token: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SendAuthVerificationEmailRequest }>(
        '/sendAuthVerificationEmail',
        {
            schema: { body: SendAuthVerificationEmailRequest }
        },
        async function (request, reply) {
            const { token } = request.body

            fastify.log.info(
                `Send Auth Verification Email Task for user ${request.body.userId} with token ${request.body.token}`
            )
            const user = await fastify.userService.getUser(request.body.userId)
            if (!user || !user.email) {
                fastify.log.error(
                    `User ${request.body.userId} not found or missing email address, cannot send password reset email`
                )
                return
            }

            await fastify.emailService.sendVerificationEmail(token, user.email)
            await reply.code(200).send()
        }
    )
}
