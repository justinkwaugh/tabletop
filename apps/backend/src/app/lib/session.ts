import { Session } from '@fastify/secure-session'

declare module '@fastify/secure-session' {
    interface SessionData {
        userId: string
        authTimestamp: string
    }
}

export function authSession({ session, userId }: { session: Session; userId: string }) {
    const data = { userId, authTimestamp: new Date().toISOString() }
    session.set('userId', userId)
    session.set('authTimestamp', data.authTimestamp)
}
