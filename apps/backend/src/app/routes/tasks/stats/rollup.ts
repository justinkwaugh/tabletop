import type { FastifyInstance } from 'fastify'
import { SiteStatsRollupTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SiteStatsRollupTask }>(
        '/rollup',
        { schema: { body: SiteStatsRollupTask } },
        async (request) => {
            await fastify.siteStatsService.runRollupTask(request.body)
            return { status: 'ok' }
        }
    )
}
