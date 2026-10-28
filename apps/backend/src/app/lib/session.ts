import { Session } from '@fastify/secure-session'
import { Value } from 'typebox/value'
import { User } from '@tabletop/common'
import {
    AuthenticatedSession,
    AuthenticationProof,
    ProviderAuthorizationAttempt,
    SessionService
} from '@tabletop/backend-services'

declare module '@fastify/secure-session' {
    interface SessionData {
        sessionId: string
        userId: string
        loginAuthorization: unknown
    }
}

export async function authSession({
    session,
    user,
    proof,
    sessions
}: {
    session: Session
    user: User
    proof: AuthenticationProof
    sessions: SessionService
}): Promise<AuthenticatedSession> {
    const previousSessionId = session.get('sessionId')
    const authenticated = await sessions.establish(user, proof)
    if (previousSessionId) {
        await sessions.revoke(previousSessionId)
    }
    session.set('sessionId', authenticated.id)
    session.set('userId', user.id)
    session.set('loginAuthorization', undefined)
    return authenticated
}

export function holdLoginAuthorization(session: Session, attempt: ProviderAuthorizationAttempt) {
    session.set('loginAuthorization', attempt)
}

export function heldLoginAuthorization(session: Session): ProviderAuthorizationAttempt | undefined {
    const held = Value.Convert(ProviderAuthorizationAttempt, session.get('loginAuthorization'))
    return Value.Check(ProviderAuthorizationAttempt, held) ? held : undefined
}

export function releaseLoginAuthorization(session: Session) {
    session.set('loginAuthorization', undefined)
}
