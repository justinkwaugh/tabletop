import { FastifyInstance } from 'fastify'
import { ExternalAuthService } from '@tabletop/common'
import {
    completeDiscordCallback,
    DiscordCallbackRequest
} from '../../../../lib/discordAuthorization.js'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DiscordCallbackRequest }>(
        '/link',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: DiscordCallbackRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for link request')
            }
            const identity = await completeDiscordCallback(fastify, request, 'link')
            const updatedUser = await fastify.userService.linkExternalAccount({
                userId: request.user.id,
                externalId: identity.externalId,
                service: ExternalAuthService.Discord
            })
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
