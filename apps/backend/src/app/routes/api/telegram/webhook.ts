import { FastifyInstance } from 'fastify'

const SECRET_HEADER = 'x-telegram-bot-api-secret-token'

export default async function (fastify: FastifyInstance) {
    fastify.post('/webhook', async function (request, reply) {
        const secret = request.headers[SECRET_HEADER]
        if (
            !fastify.telegramService.isWebhookSecret(
                typeof secret === 'string' ? secret : undefined
            )
        ) {
            return reply.status(401).send({ error: 'Bad webhook secret' })
        }

        // Anything but a 2xx makes Telegram redeliver the update, so failures are only logged.
        try {
            await fastify.telegramService.handleUpdate(request.body)
        } catch (error) {
            console.error('Could not handle a Telegram update', error)
        }
        await reply.status(200).send()
    })
}
