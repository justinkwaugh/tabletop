import type { FastifyInstance, FastifyRequest } from 'fastify'
import { ExternalAuthService } from '@tabletop/common'
import { SessionNotLiveError } from '@tabletop/backend-services'

export class ReauthenticationFailedError extends Error {
    readonly statusCode = 401

    constructor() {
        super('The proof does not belong to the signed-in Account')
        this.name = 'ReauthenticationFailedError'
    }
}

export function requireLinkedIdentity(
    request: FastifyRequest,
    service: ExternalAuthService,
    externalId: string
): void {
    if (!request.user?.externalIds.includes(`${service}:${externalId}`)) {
        throw new ReauthenticationFailedError()
    }
}

export async function reauthenticatedResponse(fastify: FastifyInstance, request: FastifyRequest) {
    const session = request.authenticatedSession
    if (!session) {
        throw new SessionNotLiveError()
    }
    const refreshed = await fastify.sessionService.recordAuthentication(session)
    return { status: 'ok', payload: { authenticatedAt: refreshed.authenticatedAt } }
}
