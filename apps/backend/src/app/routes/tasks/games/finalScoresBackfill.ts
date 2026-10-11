import type { FastifyInstance } from 'fastify'
import { FinalScoresBackfillTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: FinalScoresBackfillTask }>(
        '/finalScoresBackfill',
        { schema: { body: FinalScoresBackfillTask } },
        async (request) => {
            await fastify.gameService.backfillFinalScores(request.body)
            return { status: 'ok' }
        }
    )
}
