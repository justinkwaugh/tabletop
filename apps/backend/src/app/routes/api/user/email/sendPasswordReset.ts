import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS } from '@tabletop/common'
import { caseInsensitiveSubject, operationBudget } from '../../../../lib/operationBudget.js'

type ResetPasswordRequest = Static<typeof ResetPasswordRequest>
const ResetPasswordRequest = Type.Object({
    email: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ResetPasswordRequest }>(
        '/sendPasswordReset',
        {
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            schema: { body: ResetPasswordRequest },
            preHandler: operationBudget<{ Body: ResetPasswordRequest }>(fastify, {
                operation: 'password reset',
                max: 10,
                timeWindow: '15 minutes',
                subject: (request) => caseInsensitiveSubject(request.body.email)
            })
        },
        async function (request, _reply) {
            // The same answer whether or not an eligible Account exists, so nothing is enumerated
            const expiresAt = new Date(
                Date.now() + AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS * 1000
            )
            const user = await fastify.userService.getUserByEmail(request.body.email)
            if (user) {
                await fastify.userService.sendPasswordResetEmail(user)
            }

            return { status: 'ok', payload: { expiresAt } }
        }
    )
}
