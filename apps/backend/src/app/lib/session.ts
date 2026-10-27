import { Session } from '@fastify/secure-session'
import { canHoldAuthenticatedSession, User } from '@tabletop/common'
import { AccountUnavailableError } from '@tabletop/backend-services'

declare module '@fastify/secure-session' {
    interface SessionData {
        userId: string
        authTimestamp: string
    }
}

export function authSession({ session, user }: { session: Session; user: User }) {
    if (!canHoldAuthenticatedSession(user)) {
        throw new AccountUnavailableError(user.status)
    }
    session.set('userId', user.id)
    session.set('authTimestamp', new Date().toISOString())
}
