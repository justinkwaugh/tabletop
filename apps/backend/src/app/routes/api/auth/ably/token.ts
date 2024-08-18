import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/token',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }
            const token = await fastify.ablyService.createTokenRequest(request.user.id)
            return { status: 'ok', payload: { token } }
        }
    )
}
