import type { AuthenticatedSession } from '../../sessions/authenticatedSession.js'

export interface SessionStore {
    create(session: AuthenticatedSession): Promise<void>
    find(id: string): Promise<AuthenticatedSession | undefined>
    delete(id: string): Promise<void>
    deleteForUser(userId: string, options?: { except?: string }): Promise<void>
}
