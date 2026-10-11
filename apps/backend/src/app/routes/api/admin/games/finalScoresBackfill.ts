import type { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type FinalScoresBackfillRequest = Static<typeof FinalScoresBackfillRequest>
const FinalScoresBackfillRequest = Type.Object(
    { write: Type.Boolean() },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: FinalScoresBackfillRequest }>(
        '/finalScoresBackfill',
        {
            schema: { body: FinalScoresBackfillRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async (request) => {
            const runId = await fastify.gameService.startFinalScoresBackfill(request.body.write)
            return { status: 'ok', payload: { runId } }
        }
    )
}
