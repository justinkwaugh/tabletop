import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type SendVerificationEmailRequest = Static<typeof SendVerificationEmailRequest>
const SendVerificationEmailRequest = Type.Object(
    {
        userId: Type.String(),
        token: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SendVerificationEmailRequest }>(
        '/sendVerificationEmail',
        {
            schema: { body: SendVerificationEmailRequest }
        },
        async function (request, reply) {
            fastify.log.info(
                `Send Verification Email Task for user ${request.body.userId} with token ${request.body.token}`
            )
            const user = await fastify.userService.getUser(request.body.userId)
            if (!user || !user.email) {
                fastify.log.error(
                    `User ${request.body.userId} not found or missing email address, cannot send verification email`
                )
                return
            }

            await fastify.emailService.sendVerificationEmail(request.body.token, user.email)
            await reply.code(200).send()
        }
    )
}
