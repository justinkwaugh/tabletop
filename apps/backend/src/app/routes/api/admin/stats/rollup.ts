import type { FastifyInstance } from 'fastify'
import { isRealUtcDay, UtcDay } from '@tabletop/common'
import { Type, type Static } from 'typebox'

type SiteStatsRollupRequest = Static<typeof SiteStatsRollupRequest>
const SiteStatsRollupRequest = Type.Object(
    { from: Type.Optional(UtcDay), through: Type.Optional(UtcDay) },
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
        async (request, reply) => {
            const yesterday = fastify.siteStatsService.yesterday()
            const { from, through = yesterday } = request.body
            const validFrom = from === undefined || (isRealUtcDay(from) && from <= through)
            if (!validFrom || !isRealUtcDay(through) || through > yesterday)
                return reply.code(400).send({
                    status: 'error',
                    error: {
                        name: 'InvalidRange',
                        message: 'Roll up whole UTC days, in order, no later than yesterday'
                    }
                })
            const runId = await fastify.siteStatsService.startRollup(from, through)
            return { status: 'ok', payload: { runId } }
        }
    )
}
