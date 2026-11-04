import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/logoutAll',
        { onRequest: fastify.auth([fastify.verifyUser]) },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for logout request')
            }
            await fastify.sessionService.revokeAll(request.user.id)
            request.session.delete()
            return { status: 'ok', payload: {} }
        }
    )
}
