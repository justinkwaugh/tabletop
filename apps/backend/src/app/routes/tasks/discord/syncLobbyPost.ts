import type { FastifyInstance } from 'fastify'
import { LobbyPostTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LobbyPostTask }>(
        '/syncLobbyPost',
        { schema: { body: LobbyPostTask } },
        async (request, reply) => {
            // Refused rather than dropped, so a service missing the configuration shows in the
            // queue's retries.
            if (!fastify.lobbyPosts) return reply.code(503).send()
            await fastify.lobbyPosts.sync(request.body)
            return { status: 'ok' }
        }
    )
}
