import { Type, type Static } from 'typebox'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { ExternalAuthService } from '@tabletop/common'
import {
    type DiscordIdentity,
    InvalidOAuthStateError,
    type OAuthPurpose,
    type OAuthStateBinding
} from '@tabletop/backend-services'
import { discordRedirectUri } from './discordRedirects.js'

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

// The state is consumed before the code is exchanged, so a rejected callback never spends a request
// on Discord and a replayed state never reaches the exchange.
export async function completeDiscordCallback(
    fastify: FastifyInstance,
    request: FastifyRequest<{ Body: DiscordCallbackRequest }>,
    purpose: OAuthPurpose,
    binding: OAuthStateBinding
): Promise<DiscordIdentity> {
    const redirectUri = discordRedirectUri(purpose)
    await fastify.oauthStateService.consume(request.body.state, {
        provider: ExternalAuthService.Discord,
        purpose,
        redirectUri,
        binding
    })
    const identity = await fastify.discordOAuth.exchangeCode({
        code: request.body.code,
        redirectUri
    })
    if (!identity) {
        throw new DiscordAuthorizationFailedError()
    }
    return identity
}

export function sessionBinding(request: FastifyRequest): OAuthStateBinding {
    const session = request.authenticatedSession
    if (!session) {
        throw new InvalidOAuthStateError('session')
    }
    return { kind: 'session', sessionId: session.id, userId: session.userId }
}
