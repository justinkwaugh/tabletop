import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/repair',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyAdminMode], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            return { status: 'ok', payload: {} }
        }
    )
}
