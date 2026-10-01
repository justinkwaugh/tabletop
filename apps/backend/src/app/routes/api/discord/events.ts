import { FastifyInstance } from 'fastify'
import { APIWebhookEvent } from 'discord-api-types/v10'
import { hasValidDiscordSignature } from '../../../lib/discordSignature.js'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: APIWebhookEvent }>(
        '/events',
        { config: { rawBody: true } },
        async function (request, reply) {
            if (!(await hasValidDiscordSignature(request))) {
                return reply.status(401).send({ error: 'Bad request signature' })
            }

            await fastify.discordService.handleWebhookEvent(request.body)
            await reply.status(204).send()
        }
    )
}
