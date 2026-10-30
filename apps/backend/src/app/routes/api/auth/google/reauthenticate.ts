import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ExternalAuthService } from '@tabletop/common'
import { verifyGoogleCredential } from '../../../../lib/googleCredential.js'
import { reauthenticatedResponse, requireLinkedIdentity } from '../../../../lib/reauthentication.js'

type ReauthenticationRequest = Static<typeof ReauthenticationRequest>
const ReauthenticationRequest = Type.Object({
    credential: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ReauthenticationRequest }>(
        '/reauthenticate',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: ReauthenticationRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request) {
            const payload = await verifyGoogleCredential(request.body.credential)
            requireLinkedIdentity(request, ExternalAuthService.Google, payload.sub)
            return reauthenticatedResponse(fastify, request)
        }
    )
}
