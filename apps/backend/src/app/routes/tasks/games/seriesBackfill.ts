import type { FastifyInstance } from 'fastify'
import { SeriesBackfillTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SeriesBackfillTask }>(
        '/seriesBackfill',
        { schema: { body: SeriesBackfillTask } },
        async (request) => {
            await fastify.gameService.backfillSeries(request.body)
            return { status: 'ok' }
        }
    )
}
