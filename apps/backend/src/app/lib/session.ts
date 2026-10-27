import { Session } from '@fastify/secure-session'
import { User } from '@tabletop/common'
import { AuthenticatedSession, SessionService } from '@tabletop/backend-services'

declare module '@fastify/secure-session' {
    interface SessionData {
        sessionId: string
        userId: string
    }
}

export async function authSession({
    session,
    user,
    sessions
}: {
    session: Session
    user: User
    sessions: SessionService
}): Promise<AuthenticatedSession> {
    const previousSessionId = session.get('sessionId')
    const authenticated = await sessions.establish(user)
    if (previousSessionId) {
        await sessions.revoke(previousSessionId)
    }
    session.set('sessionId', authenticated.id)
    session.set('userId', user.id)
    return authenticated
}
