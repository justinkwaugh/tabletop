import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ExternalAuthService } from '@tabletop/common'
import { verifyGoogleCredential } from '../../../../lib/googleCredential.js'

type LinkRequest = Static<typeof LinkRequest>
const LinkRequest = Type.Object({
    credential: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LinkRequest }>(
        '/link',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: LinkRequest },
            onRequest: fastify.auth([fastify.verifyUser, fastify.verifyRecentAuthentication], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for link request')
            }
            const payload = await verifyGoogleCredential(request.body.credential)
            const updatedUser = await fastify.userService.linkExternalAccount({
                userId: request.user.id,
                externalId: payload.sub,
                service: ExternalAuthService.Google
            })
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
