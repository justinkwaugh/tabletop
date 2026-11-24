import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/link',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for Telegram link request')
            }
            if (!fastify.telegramService.isAvailable) {
                return reply.status(404).send({ error: 'Telegram notifications are not available' })
            }

            const url = await fastify.telegramService.connectLink(request.user.id)
            return { status: 'ok', payload: { url } }
        }
    )
}
