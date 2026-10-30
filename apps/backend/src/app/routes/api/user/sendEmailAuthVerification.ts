import { FastifyInstance } from 'fastify'
import { SensitiveChangeRequest } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SensitiveChangeRequest }>(
        '/sendEmailAuthVerification',
        {
            config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
            schema: { body: SensitiveChangeRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser], { relation: 'and' })
        },
        async function () {
            throw fastify.httpErrors.gone(
                'Profile changes now use identity confirmation. Reload the site and submit your change again.'
            )
        }
    )
}
