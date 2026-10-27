import { customAlphabet } from 'nanoid'
import { canHoldAuthenticatedSession, User } from '@tabletop/common'
import type { SessionStore } from '../persistence/stores/sessionStore.js'
import { AccountUnavailableError } from '../users/errors.js'
import type { AuthenticatedSession } from './authenticatedSession.js'

export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60

const SESSION_ID_LENGTH = 32
const sessionId = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    SESSION_ID_LENGTH
)

export class SessionService {
    constructor(
        private readonly sessionStore: SessionStore,
        private readonly options: { lifetimeSeconds?: number; now?: () => Date } = {}
    ) {}

    async establish(user: User): Promise<AuthenticatedSession> {
        if (!canHoldAuthenticatedSession(user)) {
            throw new AccountUnavailableError(user.status)
        }
        const createdAt = this.now()
        const session: AuthenticatedSession = {
            id: sessionId(),
            userId: user.id,
            createdAt,
            authenticatedAt: createdAt,
            expiresAt: new Date(createdAt.getTime() + this.lifetimeSeconds() * 1000)
        }
        await this.sessionStore.create(session)
        return session
    }

    async authorize(id: string): Promise<AuthenticatedSession | undefined> {
        const session = await this.sessionStore.find(id)
        if (!session) {
            return undefined
        }
        if (session.expiresAt <= this.now()) {
            await this.sessionStore.delete(id)
            return undefined
        }
        return session
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
