import type { FastifyInstance } from 'fastify'
import { UtcDay } from '@tabletop/common'
import { Type, type Static } from 'typebox'

type SiteStatsRollupRequest = Static<typeof SiteStatsRollupRequest>
const SiteStatsRollupRequest = Type.Object(
    { from: Type.Optional(UtcDay), to: Type.Optional(UtcDay) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SiteStatsRollupRequest }>(
        '/rollup',
        {
            schema: { body: SiteStatsRollupRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async (request) => ({
            status: 'ok',
            payload: { runId: await fastify.siteStatsService.startRollup(request.body) }
        })
    )
}
