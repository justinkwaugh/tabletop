import type { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type SeriesBackfillRequest = Static<typeof SeriesBackfillRequest>
const SeriesBackfillRequest = Type.Object(
    { write: Type.Boolean() },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SeriesBackfillRequest }>(
        '/seriesBackfill',
        {
            schema: { body: SeriesBackfillRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async (request) => {
            const runId = await fastify.gameService.startSeriesBackfill(request.body.write)
            return { status: 'ok', payload: { runId } }
        }
    )
}
