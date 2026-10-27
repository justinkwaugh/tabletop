import { FastifyInstance } from 'fastify'
import { ExternalAuthService } from '@tabletop/common'
import { InvalidOAuthStateError } from '@tabletop/backend-services'
import { authSession } from '../../../../lib/session.js'
import { completeDiscordCallback, DiscordCallbackRequest } from '../../../../lib/discordCallback.js'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DiscordCallbackRequest }>(
        '/login',
        {
            config: { rateLimit: { max: 50, timeWindow: '1 minute' } },
            schema: { body: DiscordCallbackRequest }
        },
        async function (request) {
            const attemptId = request.session.get('oauthAttemptId')
            if (!attemptId) {
                throw new InvalidOAuthStateError('attempt')
            }
            request.session.set('oauthAttemptId', undefined)
            const identity = await completeDiscordCallback(fastify, request, 'login', {
                kind: 'attempt',
                attemptId
            })

            const user = await fastify.userService.handleExternalAuth({
                service: ExternalAuthService.Discord,
                ...identity
            })
            await authSession({
                session: request.session,
                user,
                proof: 'authentication-method',
                sessions: fastify.sessionService
            })
            return { status: 'ok', payload: { user } }
        }
    )
}
