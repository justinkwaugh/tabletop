import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/sendEmailAuthVerification',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }
            await fastify.userService.sendEmailAuthVerification(request.user)

            return { status: 'ok', payload: {} }
        }
    )
}
