import { customAlphabet } from 'nanoid'
import { sessionGenerationOf, User } from '@tabletop/common'
import type { SessionStore } from '../persistence/stores/sessionStore.js'
import { requireSessionEligibleAccount } from '../users/accountEligibility.js'
import type { AuthenticatedSession, AuthenticationProof } from './authenticatedSession.js'
import { hasRecentAuthentication, SessionNotLiveError } from './recentAuthentication.js'

export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60

const SESSION_ID_LENGTH = 32
const sessionId = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    SESSION_ID_LENGTH
)

export type AuthorizedSession = { session: AuthenticatedSession; user: User }
export type AccountLookup = (userId: string) => Promise<User | undefined>

export class SessionService {
    constructor(
        private readonly sessionStore: SessionStore,
        private readonly options: { lifetimeSeconds?: number; now?: () => Date } = {}
    ) {}

    async establish(user: User, proof: AuthenticationProof): Promise<AuthenticatedSession> {
        requireSessionEligibleAccount(user)
        const createdAt = this.now()
        const session: AuthenticatedSession = {
            id: sessionId(),
            userId: user.id,
            generation: sessionGenerationOf(user),
            createdAt,
            ...(proof === 'authentication-method' ? { authenticatedAt: createdAt } : {}),
            expiresAt: new Date(createdAt.getTime() + this.lifetimeSeconds() * 1000)
        }
        await this.sessionStore.create(session)
        return session
    }

    async authorize(
        id: string,
        findAccount: AccountLookup
    ): Promise<AuthorizedSession | undefined> {
        const session = await this.sessionStore.find(id)
        if (!session) {
            return undefined
        }
        if (session.expiresAt <= this.now()) {
            await this.sessionStore.delete(id)
            return undefined
        }
        const user = await findAccount(session.userId)
        if (!user) {
            return undefined
        }
        if (session.generation !== sessionGenerationOf(user)) {
            await this.sessionStore.delete(id)
            return undefined
        }
        return { session, user }
    }

    isRecentlyAuthenticated(session: AuthenticatedSession): boolean {
        return hasRecentAuthentication(session, this.now())
    }

    async recordAuthentication(session: AuthenticatedSession): Promise<AuthenticatedSession> {
        const now = this.now()
        if (session.expiresAt <= now) {
            throw new SessionNotLiveError()
        }
        const refreshed = await this.sessionStore.recordAuthentication(session.id, now)
        if (!refreshed) {
            throw new SessionNotLiveError()
        }
        return refreshed
    }

    async revoke(id: string): Promise<void> {
        await this.sessionStore.delete(id)
    }

    async revokeAll(userId: string, options: { except?: string } = {}): Promise<void> {
        await this.sessionStore.deleteForUser(userId, options)
    }

    private now(): Date {
        return this.options.now?.() ?? new Date()
    }

    private lifetimeSeconds(): number {
        return this.options.lifetimeSeconds ?? SESSION_LIFETIME_SECONDS
    }
}
