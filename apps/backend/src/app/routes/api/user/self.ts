import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/self',
        {
            onRequest: fastify.auth([fastify.verifyUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            return { status: 'ok', payload: { user: request.user } }
        }
    )
}
