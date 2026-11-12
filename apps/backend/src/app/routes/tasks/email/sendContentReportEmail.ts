import { FastifyInstance } from 'fastify'
import { ContentReportEmail } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ContentReportEmail }>(
        '/sendContentReportEmail',
        { schema: { body: ContentReportEmail } },
        async function (request, reply) {
            await fastify.emailService.sendContentReportEmail(request.body)
            await reply.code(200).send()
        }
    )
}
