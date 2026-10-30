import { BaseError } from '@tabletop/common'
import type { AuthenticatedSession } from './authenticatedSession.js'
import { hasRecentAuthentication, RECENT_AUTHENTICATION_SECONDS } from './recentAuthentication.js'

export function adminModeExpiry(
    session: Pick<AuthenticatedSession, 'authenticatedAt' | 'expiresAt'>
): Date | undefined {
    if (!session.authenticatedAt) {
        return undefined
    }
    const proofExpiry = session.authenticatedAt.getTime() + RECENT_AUTHENTICATION_SECONDS * 1000
    return new Date(Math.min(proofExpiry, session.expiresAt.getTime()))
}

export function hasAdminMode(
    session: Pick<AuthenticatedSession, 'authenticatedAt' | 'adminModeExpiresAt' | 'expiresAt'>,
    now: Date
): boolean {
    if (!session.adminModeExpiresAt || session.adminModeExpiresAt <= now) {
        return false
    }
    return session.expiresAt > now && hasRecentAuthentication(session, now)
}

export class AdminModeRequiredError extends BaseError {
    readonly statusCode = 403

    constructor() {
        super({
            name: 'AdminModeRequiredError',
            message: 'This operation requires Admin Mode'
        })
    }
}

export class AdministratorRequiredError extends BaseError {
    readonly statusCode = 403

    constructor() {
        super({
            name: 'AdministratorRequiredError',
            message: 'Only an Administrator may enter Admin Mode'
        })
    }
}
