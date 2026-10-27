import { FastifyInstance } from 'fastify'
import { ExternalAuthService } from '@tabletop/common'
import {
    completeDiscordCallback,
    DiscordCallbackRequest,
    sessionBinding
} from '../../../../lib/discordCallback.js'
import { reauthenticatedResponse, requireLinkedIdentity } from '../../../../lib/reauthentication.js'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DiscordCallbackRequest }>(
        '/reauthenticate',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: DiscordCallbackRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request) {
            const identity = await completeDiscordCallback(
                fastify,
                request,
                'reauthenticate',
                sessionBinding(request)
            )
            requireLinkedIdentity(request, ExternalAuthService.Discord, identity.externalId)
            return reauthenticatedResponse(fastify, request)
        }
    )
}
