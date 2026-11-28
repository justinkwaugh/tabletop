import type { FastifyInstance } from 'fastify'
import { TimeDifferenceNoticeTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: TimeDifferenceNoticeTask }>(
        '/sendTimeDifferenceNotice',
        { schema: { body: TimeDifferenceNoticeTask } },
        async (request) => {
            await fastify.timeDifferenceNotice.send(request.body)
            return { status: 'ok', payload: {} }
        }
    )
}
