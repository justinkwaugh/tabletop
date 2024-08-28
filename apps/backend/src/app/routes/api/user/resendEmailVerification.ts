import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/resendEmailVerification',
        {
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyIncompleteUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            await fastify.userService.sendVerificationEmail(request.user)

            return { status: 'ok', payload: {} }
        }
    )
}
