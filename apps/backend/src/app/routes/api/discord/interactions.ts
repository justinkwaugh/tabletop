import { FastifyInstance } from 'fastify'
import { verifyKey } from 'discord-interactions'
import { APIBaseInteraction, InteractionType } from 'discord-api-types/v10'

const CLIENT_PUBLIC_KEY = process.env['DISCORD_PUBLIC_KEY'] ?? ''

export default async function (fastify: FastifyInstance) {
    fastify.post('/interactions', { config: { rawBody: true } }, async function (request, reply) {
        // Verify the request
        const signature = request.headers['x-signature-ed25519'] as string
        const timestamp = request.headers['x-signature-timestamp'] as string
        const rawBody = request.rawBody
        if (!rawBody || !signature || !timestamp) {
            return reply.status(401).send({ error: 'Bad request signature' })
        }
        const isValidRequest = await verifyKey(rawBody, signature, timestamp, CLIENT_PUBLIC_KEY)
        if (!isValidRequest) {
            return reply.status(401).send({ error: 'Bad request signature' })
        }

        // Handle the payload
        const interaction = request.body as APIBaseInteraction<InteractionType, unknown>
        const response = await fastify.discordService.handleInteraction(interaction)
        await reply.send(response)
    })
}
