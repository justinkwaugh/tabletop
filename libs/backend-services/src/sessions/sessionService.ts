import { customAlphabet } from 'nanoid'
import { BaseError, sessionGenerationOf, User } from '@tabletop/common'
import type { SessionStore } from '../persistence/stores/sessionStore.js'
import { requireSessionEligibleAccount } from '../users/accountEligibility.js'
import {
    issueProviderAuthorization,
    type ProviderAuthorizationAttempt,
    type ProviderAuthorizationRequest,
    verifyProviderAuthorization
} from '../oauth/providerAuthorization.js'
import {
    isSessionLiveForAccount,
    type AuthenticatedSession,
    type AuthenticationProof
} from './authenticatedSession.js'
import { hasRecentAuthentication } from './recentAuthentication.js'

export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60

const SESSION_ID_LENGTH = 32
const sessionId = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    SESSION_ID_LENGTH
)

export type AuthorizedSession = { session: AuthenticatedSession; user: User }
export type AccountLookup = (userId: string) => Promise<User | undefined>

export class SessionNotLiveError extends BaseError {
    readonly statusCode = 401

    constructor() {
        super({
            name: 'SessionNotLiveError',
            message: 'The Authenticated Session is no longer live'
        })
    }
}

export class SessionService {
    constructor(
        private readonly sessionStore: SessionStore,
        private readonly options: { lifetimeSeconds?: number; now?: () => Date } = {}
    ) {}

    async establish(user: User, proof: AuthenticationProof): Promise<AuthenticatedSession> {
        requireSessionEligibleAccount(user)
        const createdAt = this.now()
        const authenticatedAt =
            proof === 'authentication-method' ? createdAt : proof.authenticatedAt
        const session: AuthenticatedSession = {
            id: sessionId(),
            userId: user.id,
            generation: sessionGenerationOf(user),
            createdAt,
            ...(authenticatedAt ? { authenticatedAt } : {}),
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
        const user = await findAccount(session.userId)
        if (!user) {
            return undefined
        }
        if (!isSessionLiveForAccount(session, user, this.now())) {
            await this.sessionStore.delete(id)
            return undefined
        }
        return { session, user }
    }

    isRecentlyAuthenticated(session: AuthenticatedSession): boolean {
        return hasRecentAuthentication(session, this.now())
    }

    async recordAuthentication(session: AuthenticatedSession): Promise<AuthenticatedSession> {
        const authenticatedAt = this.now()
        return this.updateLive(session.id, (live) => ({ ...live, authenticatedAt }))
    }

    issueProviderAuthorization(
        request: ProviderAuthorizationRequest
    ): ProviderAuthorizationAttempt {
        return issueProviderAuthorization(request, this.now())
    }

    verifyProviderAuthorization(
        attempt: ProviderAuthorizationAttempt | undefined,
        state: string,
        expected: ProviderAuthorizationRequest
    ): void {
        verifyProviderAuthorization(attempt, state, expected, this.now())
    }

    async beginProviderAuthorization(
        session: AuthenticatedSession,
        request: ProviderAuthorizationRequest
    ): Promise<ProviderAuthorizationAttempt> {
        const providerAuthorization = this.issueProviderAuthorization(request)
        await this.updateLive(session.id, (live) => ({ ...live, providerAuthorization }))
        return providerAuthorization
    }

    async completeProviderAuthorization(
        session: AuthenticatedSession,
        state: string,
        expected: ProviderAuthorizationRequest
    ): Promise<void> {
        await this.updateLive(session.id, ({ providerAuthorization, ...live }) => {
            this.verifyProviderAuthorization(providerAuthorization, state, expected)
            return live
        })
    }

    async revoke(id: string): Promise<void> {
        await this.sessionStore.delete(id)
    }

    async revokeAll(userId: string, options: { except?: string } = {}): Promise<void> {
        await this.sessionStore.deleteForUser(userId, options)
    }

    private async updateLive(
        id: string,
        change: (live: AuthenticatedSession) => AuthenticatedSession
    ): Promise<AuthenticatedSession> {
        const now = this.now()
        const updated = await this.sessionStore.update(id, (stored) => {
            if (stored.expiresAt <= now) {
                throw new SessionNotLiveError()
            }
            return change(stored)
        })
        if (!updated) {
            throw new SessionNotLiveError()
        }
        return updated
    }

    private now(): Date {
        return this.options.now?.() ?? new Date()
    }

    private lifetimeSeconds(): number {
        return this.options.lifetimeSeconds ?? SESSION_LIFETIME_SECONDS
    }
}
