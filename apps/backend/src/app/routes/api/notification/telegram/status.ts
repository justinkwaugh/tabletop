import { FastifyInstance } from 'fastify'

// Frontend 25.8.0 reads this; remove once a frontend reading /notification/registrations is live.
export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/status',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for Telegram status request')
            }

            const available = fastify.telegramService.isAvailable
            const connected = available
                ? await fastify.telegramService.isConnected(request.user.id)
                : false
            return { status: 'ok', payload: { available, connected } }
        }
    )
}
