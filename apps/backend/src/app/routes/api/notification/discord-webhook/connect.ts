import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type ConnectDiscordWebhook = Static<typeof ConnectDiscordWebhook>
const ConnectDiscordWebhook = Type.Object(
    { url: Type.String({ maxLength: 500 }) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ConnectDiscordWebhook }>(
        '/connect',
        {
            schema: { body: ConnectDiscordWebhook },
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for Discord webhook connect request')
            }

            const result = await fastify.discordWebhookService.connect(
                request.user.id,
                request.body.url
            )
            return { status: 'ok', payload: { result } }
        }
    )
}
