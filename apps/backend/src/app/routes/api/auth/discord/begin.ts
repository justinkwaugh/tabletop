import { FastifyInstance, FastifyRequest, RouteShorthandOptions } from 'fastify'
import { nanoid } from 'nanoid'
import { ExternalAuthService } from '@tabletop/common'
import {
    OAUTH_PURPOSES,
    type OAuthPurpose,
    type OAuthStateBinding
} from '@tabletop/backend-services'
import { discordRedirectUri } from '../../../../lib/discordRedirects.js'

export default async function (fastify: FastifyInstance) {
    const guards: Record<OAuthPurpose, RouteShorthandOptions['onRequest']> = {
        login: undefined,
        link: fastify.auth([fastify.verifyUser, fastify.verifyRecentAuthentication], {
            relation: 'and'
        }),
        reauthenticate: fastify.auth([fastify.verifyUser], { relation: 'and' })
    }

    function binding(request: FastifyRequest, purpose: OAuthPurpose): OAuthStateBinding {
        if (purpose === 'login') {
            const attemptId = nanoid()
            request.session.set('oauthAttemptId', attemptId)
            return { kind: 'attempt', attemptId }
        }
        const session = request.authenticatedSession
        if (!session) {
            throw fastify.httpErrors.unauthorized('No session found')
        }
        return { kind: 'session', sessionId: session.id, userId: session.userId }
    }

    for (const purpose of OAUTH_PURPOSES) {
        fastify.post(
            `/begin/${purpose}`,
            {
                config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
                onRequest: guards[purpose]
            },
            async function (request) {
                const redirectUri = discordRedirectUri(purpose)
                const { state } = await fastify.oauthStateService.issue({
                    provider: ExternalAuthService.Discord,
                    purpose,
                    redirectUri,
                    binding: binding(request, purpose)
                })
                const authorizationUrl = fastify.discordOAuth.authorizationUrl({
                    redirectUri,
                    state
                })
                return { status: 'ok', payload: { state, authorizationUrl } }
            }
        )
    }
}
