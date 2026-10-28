import { FastifyInstance } from 'fastify'
import { ExternalAuthService } from '@tabletop/common'
import { authSession } from '../../../../lib/session.js'
import {
    completeDiscordCallback,
    DiscordCallbackRequest
} from '../../../../lib/discordAuthorization.js'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DiscordCallbackRequest }>(
        '/login',
        {
            config: { rateLimit: { max: 50, timeWindow: '1 minute' } },
            schema: { body: DiscordCallbackRequest }
        },
        async function (request) {
            const identity = await completeDiscordCallback(fastify, request, 'login')

            const user = await fastify.userService.handleExternalAuth({
                service: ExternalAuthService.Discord,
                ...identity
            })
            await authSession({
                session: request.session,
                user,
                sessions: fastify.sessionService
            })
            return { status: 'ok', payload: { user } }
        }
    )
}
