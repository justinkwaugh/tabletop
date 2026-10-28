import { Session } from '@fastify/secure-session'
import { User } from '@tabletop/common'
import { requireSessionEligibleAccount } from '@tabletop/backend-services'

declare module '@fastify/secure-session' {
    interface SessionData {
        userId: string
        authTimestamp: string
    }
}

export function authSession({ session, user }: { session: Session; user: User }) {
    requireSessionEligibleAccount(user)
    session.set('userId', user.id)
    session.set('authTimestamp', new Date().toISOString())
}
