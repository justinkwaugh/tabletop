import type { AuthenticatedSession } from '../../sessions/authenticatedSession.js'
import type { SessionStore } from '../stores/sessionStore.js'

export class MemorySessionStore implements SessionStore {
    private readonly sessions = new Map<string, AuthenticatedSession>()

    async create(session: AuthenticatedSession): Promise<void> {
        if (this.sessions.has(session.id)) {
            throw new Error(`Session ${session.id} already exists`)
        }
        this.sessions.set(session.id, structuredClone(session))
    }

    async find(id: string): Promise<AuthenticatedSession | undefined> {
        const session = this.sessions.get(id)
        return session ? structuredClone(session) : undefined
    }

    async recordAuthentication(
        id: string,
        authenticatedAt: Date
    ): Promise<AuthenticatedSession | undefined> {
        const session = this.sessions.get(id)
        if (!session) {
            return undefined
        }
        const refreshed = { ...session, authenticatedAt }
        this.sessions.set(id, refreshed)
        return structuredClone(refreshed)
    }

    async setAdminMode(
        id: string,
        adminModeExpiresAt: Date | undefined
    ): Promise<AuthenticatedSession | undefined> {
        const session = this.sessions.get(id)
        if (!session) {
            return undefined
        }
        const { adminModeExpiresAt: _cleared, ...cleared } = session
        const updated =
            adminModeExpiresAt === undefined ? cleared : { ...cleared, adminModeExpiresAt }
        this.sessions.set(id, updated)
        return structuredClone(updated)
    }

    async delete(id: string): Promise<void> {
        this.sessions.delete(id)
    }

    async deleteForUser(userId: string, { except }: { except?: string } = {}): Promise<void> {
        for (const [id, session] of this.sessions) {
            if (session.userId === userId && id !== except) {
                this.sessions.delete(id)
            }
        }
    }

    get size(): number {
        return this.sessions.size
    }
}
