import { customAlphabet } from 'nanoid'
import {
    assertExists,
    BaseError,
    isAdministrator,
    sessionGenerationOf,
    User
} from '@tabletop/common'
import type { SessionStore } from '../persistence/stores/sessionStore.js'
import { requireSessionEligibleAccount } from '../users/accountEligibility.js'
import {
    issueProviderAuthorization,
    type ProviderAuthorizationAttempt,
    type ProviderAuthorizationRequest,
    verifyProviderAuthorization
} from '../oauth/providerAuthorization.js'
import type { AuthenticatedSession, AuthenticationProof } from './authenticatedSession.js'
import {
    hasRecentAuthentication,
    RecentAuthenticationRequiredError
} from './recentAuthentication.js'
import { adminModeExpiry, AdministratorRequiredError, hasAdminMode } from './adminMode.js'
import { RELAY_STATS_TOPIC } from '../notifications/topics.js'
import type { RealtimeControl } from '../realtime/realtimeControl.js'

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

export type SessionServiceOptions = {
    lifetimeSeconds?: number
    now?: () => Date
    // Told when a session's administrative grants on the realtime relay must end
    realtime?: RealtimeControl
}

export class SessionService {
    constructor(
        private readonly sessionStore: SessionStore,
        private readonly options: SessionServiceOptions = {}
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

    isInAdminMode(session: AuthenticatedSession): boolean {
        return hasAdminMode(session, this.now())
    }

    async activateAdminMode(
        session: AuthenticatedSession,
        account: User
    ): Promise<AuthenticatedSession> {
        if (session.userId !== account.id) {
            throw new SessionNotLiveError()
        }
        if (!isAdministrator(account)) {
            throw new AdministratorRequiredError()
        }
        const now = this.now()
        return this.updateLive(session.id, (live) => {
            if (!hasRecentAuthentication(live, now)) {
                throw new RecentAuthenticationRequiredError()
            }
            const adminModeExpiresAt = adminModeExpiry(live)
            assertExists(adminModeExpiresAt, 'Recent Authentication implies an authentication time')
            return { ...live, adminModeExpiresAt }
        })
    }

    async deactivateAdminMode(session: AuthenticatedSession): Promise<void> {
        await this.sessionStore.update(
            session.id,
            ({ adminModeExpiresAt: _ended, ...live }) => live
        )
        await this.endAdminGrants(session.userId)
    }

    // Ends the session. A session that held Admin Mode also loses its administrative grants
    // on the relay, which the relay bounds by the mode's end in any case.
    async revoke(id: string): Promise<void> {
        const session = await this.sessionStore.find(id)
        await this.sessionStore.delete(id)
        if (session && session.adminModeExpiresAt && session.adminModeExpiresAt > this.now()) {
            await this.endAdminGrants(session.userId)
        }
    }

    // Ends every session of the Account; every realtime connection of the Account closes and
    // the clients of the sessions that remain, if any, reconnect with fresh tokens.
    async revokeAll(userId: string, options: { except?: string } = {}): Promise<void> {
        await this.sessionStore.deleteForUser(userId, options)
        await this.options.realtime?.revokeAccount(userId)
    }

    // Relay grants that only Admin Mode confers; the relay keeps the Account's connections
    // and their ordinary Topics.
    async endAdminGrants(userId: string): Promise<void> {
        await this.options.realtime?.revokeTopics(userId, [RELAY_STATS_TOPIC])
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
