import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/lobbyPosts',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async (_request, reply) => {
            if (!fastify.lobbyPosts) return reply.code(503).send()
            const gameIds = await fastify.lobbyPosts.queueOpenGames()
            return { status: 'ok', payload: { gameIds } }
        }
    )
}
