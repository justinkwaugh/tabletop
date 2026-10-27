import { FastifyInstance } from 'fastify'
import { SensitiveChangeRequest } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SensitiveChangeRequest }>(
        '/sendEmailAuthVerification',
        {
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            schema: { body: SensitiveChangeRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }
            const { expiresAt } = await fastify.userService.sendSensitiveChangeChallenge(
                request.user,
                request.body
            )

            return { status: 'ok', payload: { expiresAt } }
        }
    )
}
