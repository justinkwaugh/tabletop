import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type ResetPasswordRequest = Static<typeof ResetPasswordRequest>
const ResetPasswordRequest = Type.Object({
    email: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ResetPasswordRequest }>(
        '/sendPasswordReset',
        {
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            schema: { body: ResetPasswordRequest }
        },
        async function (request, _reply) {
            const user = await fastify.userService.getUserByEmail(request.body.email)
            if (user) {
                await fastify.userService.sendPasswordResetEmail(user)
            }

            return { status: 'ok', payload: {} }
        }
    )
}
