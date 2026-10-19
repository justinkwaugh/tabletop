import type { FastifyInstance } from 'fastify'
import { UtcDayRange } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: UtcDayRange }>(
        '/report',
        {
            schema: { querystring: UtcDayRange },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async (request) => ({
            status: 'ok',
            payload: await fastify.siteStatsService.getReport(request.query)
        })
    )
}
