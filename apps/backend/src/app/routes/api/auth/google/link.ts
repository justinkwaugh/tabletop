import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ExternalAuthService } from '@tabletop/common'
import { verifyGoogleCredential } from '../../../../lib/googleCredential.js'

type LoginRequest = Static<typeof LoginRequest>
const LoginRequest = Type.Object({
    credential: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LoginRequest }>(
        '/link',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: LoginRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
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
