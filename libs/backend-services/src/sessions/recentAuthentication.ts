import { BaseError } from '@tabletop/common'
import type { AuthenticatedSession } from './authenticatedSession.js'

export const RECENT_AUTHENTICATION_SECONDS = 15 * 60

export function hasRecentAuthentication(
    session: Pick<AuthenticatedSession, 'authenticatedAt'>,
    now: Date
): boolean {
    if (!session.authenticatedAt) {
        return false
    }
    const elapsed = now.getTime() - session.authenticatedAt.getTime()
    return elapsed >= 0 && elapsed < RECENT_AUTHENTICATION_SECONDS * 1000
}

export class RecentAuthenticationRequiredError extends BaseError {
    readonly statusCode = 403

    constructor() {
        super({
            name: 'RecentAuthenticationRequiredError',
            message: 'This operation requires Recent Authentication'
        })
    }
}

export class SessionNotLiveError extends BaseError {
    readonly statusCode = 401

    constructor(sessionId: string) {
        super({
            name: 'SessionNotLiveError',
            message: 'The Authenticated Session is no longer live',
            metadata: { sessionId }
        })
    }
}
