import { customAlphabet } from 'nanoid'
import {
    assertExists,
    canHoldAuthenticatedSession,
    isAdministrator,
    sessionGenerationOf,
    User
} from '@tabletop/common'
import type { SessionStore } from '../persistence/stores/sessionStore.js'
import { AccountUnavailableError } from '../users/errors.js'
import type { AuthenticatedSession, AuthenticationProof } from './authenticatedSession.js'
import {
    hasRecentAuthentication,
    RecentAuthenticationRequiredError,
    SessionNotLiveError
} from './recentAuthentication.js'
import { adminModeExpiry, AdministratorRequiredError, hasAdminMode } from './adminMode.js'

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
        if (!canHoldAuthenticatedSession(user)) {
            throw new AccountUnavailableError(user.status)
        }
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

    isInAdminMode(session: AuthenticatedSession): boolean {
        return hasAdminMode(session, this.now())
    }

    async activateAdminMode(
        session: AuthenticatedSession,
        account: User
    ): Promise<AuthenticatedSession> {
        const now = this.now()
        if (session.expiresAt <= now || session.userId !== account.id) {
            throw new SessionNotLiveError()
        }
        if (!isAdministrator(account)) {
            throw new AdministratorRequiredError()
        }
        if (!hasRecentAuthentication(session, now)) {
            throw new RecentAuthenticationRequiredError()
        }
        const expiresAt = adminModeExpiry(session)
        assertExists(expiresAt, 'Recent Authentication implies an authentication time')
        const activated = await this.sessionStore.setAdminMode(session.id, expiresAt)
        if (!activated) {
            throw new SessionNotLiveError()
        }
        return activated
    }

    async deactivateAdminMode(session: AuthenticatedSession): Promise<void> {
        await this.sessionStore.setAdminMode(session.id, undefined)
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
