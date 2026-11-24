import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/registrations',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for notification registrations request')
            }

            const registrations = await fastify.topicRegistrationsService.forUser(request.user.id)
            return { status: 'ok', payload: { registrations } }
        }
    )
}
