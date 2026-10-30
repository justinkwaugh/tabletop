import { FastifyInstance } from 'fastify'
import { authenticatedAccountSubject, operationBudget } from '../../../lib/operationBudget.js'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/resendEmailVerification',
        {
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyIncompleteUser, fastify.verifyRoleUser], {
                relation: 'and'
            }),
            preHandler: operationBudget(fastify, {
                operation: 'email verification',
                max: 10,
                timeWindow: '15 minutes',
                subject: authenticatedAccountSubject
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { expiresAt } = await fastify.userService.sendVerificationEmail(request.user)

            return { status: 'ok', payload: { expiresAt } }
        }
    )
}
