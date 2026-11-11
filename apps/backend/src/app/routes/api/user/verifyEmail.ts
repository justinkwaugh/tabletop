import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type VerifyEmailRequest = Static<typeof VerifyEmailRequest>
const VerifyEmailRequest = Type.Object(
    {
        code: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: VerifyEmailRequest }>(
        '/email/verify',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: VerifyEmailRequest },
            onRequest: fastify.auth([fastify.verifyUser])
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for verify request')
            }
            const updatedUser = await fastify.userService.verifyEmail(
                request.user,
                request.body.code.trim()
            )
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
