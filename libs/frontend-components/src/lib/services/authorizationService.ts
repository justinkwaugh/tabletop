import type { User } from '@tabletop/common'

export enum AuthorizationCategory {
    ActiveUser = 'activeUser',
    NoUser = 'noUser',
    Onboarding = 'onboarding'
}

export type AuthorizationService = {
    isAdmin: boolean
    showDebug: boolean
    actAsAdmin: boolean
    debugViewEnabled: boolean
    adminCapabilitiesEnabled: boolean

    initialize(): Promise<void>

    authorizeRoute({
        category,
        intendedUrl
    }: {
        category: AuthorizationCategory
        intendedUrl: URL
    }): Promise<boolean>

    getSessionUser(): User | undefined
    setSessionUser(user: User): void
    clearSessionUser(): void
    onLogin(user: User): Promise<void>
    onLogout(): Promise<void>
}
