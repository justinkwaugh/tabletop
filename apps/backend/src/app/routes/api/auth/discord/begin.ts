import { FastifyInstance, RouteShorthandOptions } from 'fastify'
import {
    OAUTH_PURPOSES,
    OAUTH_STATE_LIFETIME_SECONDS,
    type OAuthPurpose
} from '@tabletop/backend-services'
import { beginDiscordAuthorization } from '../../../../lib/discordAuthorization.js'

export default async function (fastify: FastifyInstance) {
    const guards: Record<OAuthPurpose, RouteShorthandOptions['onRequest']> = {
        login: undefined,
        link: fastify.auth([fastify.verifyUser, fastify.verifyRecentAuthentication], {
            relation: 'and'
        }),
        reauthenticate: fastify.auth([fastify.verifyUser], { relation: 'and' })
    }

    for (const purpose of OAUTH_PURPOSES) {
        fastify.post(
            `/begin/${purpose}`,
            {
                config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
                onRequest: guards[purpose]
            },
            async function (request) {
                const { state, redirectUri } = await beginDiscordAuthorization(
                    fastify,
                    request,
                    purpose
                )
                return {
                    status: 'ok',
                    payload: {
                        state,
                        authorizationUrl: fastify.discordOAuth.authorizationUrl({
                            redirectUri,
                            state
                        }),
                        expiresInSeconds: OAUTH_STATE_LIFETIME_SECONDS
                    }
                }
            }
        )
    }
}
