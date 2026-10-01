import { FastifyInstance } from 'fastify'
import { APIBaseInteraction, InteractionType } from 'discord-api-types/v10'
import { hasValidDiscordSignature } from '../../../lib/discordSignature.js'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: APIBaseInteraction<InteractionType, unknown> }>(
        '/interactions',
        { config: { rawBody: true } },
        async function (request, reply) {
            if (!(await hasValidDiscordSignature(request))) {
                return reply.status(401).send({ error: 'Bad request signature' })
            }

            const response = await fastify.discordService.handleInteraction(request.body)
            await reply.send(response)
        }
    )
}
