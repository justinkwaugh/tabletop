import { Type, type Static } from 'typebox'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { ExternalAuthService } from '@tabletop/common'
import type {
    AuthenticatedSession,
    DiscordIdentity,
    OAuthPurpose,
    ProviderAuthorizationAttempt,
    ProviderAuthorizationRequest
} from '@tabletop/backend-services'
import { discordRedirectUri } from './discordRedirects.js'
import {
    heldLoginAuthorization,
    holdLoginAuthorization,
    releaseLoginAuthorization
} from './session.js'

export type DiscordCallbackRequest = Static<typeof DiscordCallbackRequest>
export const DiscordCallbackRequest = Type.Object(
    {
        code: Type.String(),
        state: Type.String()
    },
    { additionalProperties: false }
)

export class DiscordAuthorizationFailedError extends Error {
    readonly statusCode = 401

    constructor() {
        super('Discord did not confirm the authorization')
        this.name = 'DiscordAuthorizationFailedError'
    }
}

// Sign-in has no Authenticated Session to hold its attempt, so the encrypted session cookie holds it.
export async function beginDiscordAuthorization(
    fastify: FastifyInstance,
    request: FastifyRequest,
    purpose: OAuthPurpose
): Promise<ProviderAuthorizationAttempt> {
    const authorization = discordAuthorization(purpose)
    if (purpose === 'login') {
        const attempt = fastify.sessionService.issueProviderAuthorization(authorization)
        holdLoginAuthorization(request.session, attempt)
        return attempt
    }
    return fastify.sessionService.beginProviderAuthorization(
        signedInSession(fastify, request),
        authorization
    )
}

// The attempt is checked before the code is exchanged, so a refused callback never reaches Discord.
export async function completeDiscordCallback(
    fastify: FastifyInstance,
    request: FastifyRequest<{ Body: DiscordCallbackRequest }>,
    purpose: OAuthPurpose
): Promise<DiscordIdentity> {
    const authorization = discordAuthorization(purpose)
    const { code, state } = request.body
    if (purpose === 'login') {
        fastify.sessionService.verifyProviderAuthorization(
            heldLoginAuthorization(request.session),
            state,
            authorization
        )
        releaseLoginAuthorization(request.session)
    } else {
        await fastify.sessionService.completeProviderAuthorization(
            signedInSession(fastify, request),
            state,
            authorization
        )
    }
    const identity = await fastify.discordOAuth.exchangeCode({
        code,
        redirectUri: authorization.redirectUri
    })
    if (!identity) {
        throw new DiscordAuthorizationFailedError()
    }
    return identity
}

function discordAuthorization(purpose: OAuthPurpose): ProviderAuthorizationRequest {
    return {
        provider: ExternalAuthService.Discord,
        purpose,
        redirectUri: discordRedirectUri(purpose)
    }
}

function signedInSession(fastify: FastifyInstance, request: FastifyRequest): AuthenticatedSession {
    const session = request.authenticatedSession
    if (!session) {
        throw fastify.httpErrors.unauthorized('No session found')
    }
    return session
}
