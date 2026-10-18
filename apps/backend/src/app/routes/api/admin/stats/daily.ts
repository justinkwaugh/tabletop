import type { FastifyInstance, FastifyReply } from 'fastify'
import { isRealUtcDay, SITE_STATS_MAX_RANGE_DAYS, utcDayCount, UtcDay } from '@tabletop/common'
import { Type, type Static } from 'typebox'

type SiteStatsRangeQuery = Static<typeof SiteStatsRangeQuery>
const SiteStatsRangeQuery = Type.Object(
    { from: UtcDay, to: UtcDay },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: SiteStatsRangeQuery }>(
        '/daily',
        {
            schema: { querystring: SiteStatsRangeQuery },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async (request, reply) => {
            const { from, to } = request.query
            if (!isRealUtcDay(from) || !isRealUtcDay(to) || from > to)
                return invalidRange(reply, 'The range must run from one real UTC day to a later one')
            if (utcDayCount(from, to) > SITE_STATS_MAX_RANGE_DAYS)
                return invalidRange(reply, `The range may span at most ${SITE_STATS_MAX_RANGE_DAYS} days`)
            return { status: 'ok', payload: await fastify.siteStatsService.getRange(from, to) }
        }
    )
}

function invalidRange(reply: FastifyReply, message: string) {
    return reply.code(400).send({ status: 'error', error: { name: 'InvalidRange', message } })
}
