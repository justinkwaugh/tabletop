import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/now',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyAdminMode], {
                relation: 'and'
            })
        },
        async () => ({ status: 'ok', payload: await fastify.siteStatsService.getNow() })
    )
}
