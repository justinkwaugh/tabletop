import { FastifyInstance } from 'fastify'
import {
    BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH,
    BUG_REPORT_SCREENSHOT_MAX_COUNT,
    BugReportRequest
} from '@tabletop/common'

const REPORT_TEXT_BYTES = 64 * 1024
const BODY_LIMIT =
    BUG_REPORT_SCREENSHOT_MAX_COUNT * BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH + REPORT_TEXT_BYTES

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: BugReportRequest }>(
        '/reportBug',
        {
            schema: { body: BugReportRequest },
            bodyLimit: BODY_LIMIT,
            config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            const principal = request.principal
            if (!principal) {
                throw Error('No principal found for bug report request')
            }
            if (!fastify.bugReportService) {
                return reply.code(503).send()
            }

            await fastify.bugReportService.reportBug({ principal, report: request.body })
            return { status: 'ok' }
        }
    )
}
