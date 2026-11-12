import { FastifyInstance } from 'fastify'
import { ContentReportRequest } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ContentReportRequest }>(
        '/report',
        {
            schema: { body: ContentReportRequest },
            config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for report request')
            }
            if (!fastify.contentReports) {
                return reply.code(503).send()
            }
            await fastify.contentReports.report(request.user, request.body)
            return { status: 'ok' }
        }
    )
}
