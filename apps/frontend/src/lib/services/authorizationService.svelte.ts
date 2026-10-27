import { canHoldAuthenticatedSession, Role, User, UserStatus } from '@tabletop/common'
import { goto, invalidateAll } from '$app/navigation'
import { redirect } from '@sveltejs/kit'
import { AuthorizationCategory, type TabletopApi } from '@tabletop/frontend-components'
import {
    clearLoginContinuation,
    saveLoginContinuation,
    takeLoginContinuation
} from '$lib/utils/loginContinuation'
import { readStoredValue, removeStoredValue, writeStoredValue } from '$lib/utils/storedValue'
import { browserTimeZone } from '$lib/utils/timeZones'
import { reauthentication } from '$lib/stores/reauthentication.svelte'

/**
 *
 * @class AuthorizationService
 *
 * @description
 * This service is responsible for loading and storing the current user for the session session and provides
 * an authorization method for checking if the current user is authorized to access a given route and will
 * redirect as needed if not authorized.
 *
 * Note that because svelte-kit does not allow async method calls in component script tags, the `getSessionUser`
 * method is synchronous and will return null until the session user has been loaded. This means the `initialize`
 * method must be called in a page or layout load method to ensure that the session user has been loaded
 * before calling `getSessionUser`.  Normally this is done indirectly by calling the `authorizeRoute` method,
 * but can also be called directly if desired.
 **/

export { AuthorizationCategory }

export class AuthorizationService {
    private sessionUser?: User | undefined = $state(undefined)
    private initialized: boolean = false
    private initializationPromise: Promise<void> | null = null
    private verification: Promise<boolean> = Promise.resolve(false)
    private static readonly storageKey = 'sessionUser'

    // Admin Mode is held by the server on the Authenticated Session; the client only mirrors
    // the expiry it was told and asks again after it has passed.
    private adminModeExpiresAt: Date | undefined = $state(undefined)
    private adminModeClock: number = $state(0)
    private adminModeExpiryTimer: ReturnType<typeof setTimeout> | undefined

    isAdmin: boolean = $derived(Boolean(this.sessionUser?.roles.includes(Role.Admin)))
    isDeveloper: boolean = $derived(Boolean(this.sessionUser?.roles.includes(Role.Developer)))
    canUseDeveloperTools: boolean = $derived(this.isAdmin || this.isDeveloper)
    debugViewEnabled: boolean = $state(false)
    adminCapabilitiesEnabled: boolean = $derived(
        this.adminModeExpiresAt !== undefined &&
            this.adminModeExpiresAt.getTime() > this.adminModeClock
    )

    showDebug: boolean = $derived(this.canUseDeveloperTools && this.debugViewEnabled)
    actAsAdmin: boolean = $derived(this.isAdmin && this.adminCapabilitiesEnabled)

    constructor(
        private api: TabletopApi,
        private readonly onSessionUserSet: () => void,
        private readonly onSessionUserCleared: () => void
    ) {}

    public async initialize(): Promise<void> {
        if (this.initialized) {
            return
        }

        const storedUser = readStoredValue(AuthorizationService.storageKey, User)
        if (storedUser) {
            this.setSessionUser(storedUser)
            this.initialized = true
            this.verification = this.verifyStoredSessionUser(storedUser)
            void this.verification.then(async (sessionChanged) => {
                if (sessionChanged) {
                    await invalidateAll()
                }
            })
            return
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.loadSessionUser().then(() => {
                this.initialized = true
                this.initializationPromise = null
            })
        }
        return this.initializationPromise
    }

    public async authorizeRoute({
        category,
        intendedUrl
    }: {
        category: AuthorizationCategory
        intendedUrl: URL
    }): Promise<boolean> {
        await this.initialize()
        const user = this.getSessionUser()

        let shouldRedirect = false
        switch (category) {
            case AuthorizationCategory.ActiveUser:
                if (user?.status !== UserStatus.Active) {
                    shouldRedirect = true
                }
                break
            case AuthorizationCategory.NoUser:
                if (user) {
                    shouldRedirect = true
                }
                break
            case AuthorizationCategory.Onboarding:
                if (user?.status !== UserStatus.Incomplete) {
                    shouldRedirect = true
                }
                break
        }

        if (shouldRedirect) {
            if (category === AuthorizationCategory.ActiveUser) {
                saveLoginContinuation(`${intendedUrl.pathname}${intendedUrl.search}`)
            }
            this.redirect(user)
            return false
        }
        return true
    }

    public async whenSessionVerified(): Promise<void> {
        await this.verification
    }

    public async requestAdminMode(): Promise<void> {
        if (!this.isAdmin) {
            return
        }
        await reauthentication.run({
            description: 'Entering Admin Mode',
            retry: async () => this.adoptAdminMode(await this.api.activateAdminMode())
        })
    }

    public async deactivateAdminMode(): Promise<void> {
        this.adoptAdminMode(undefined)
        await this.api.deactivateAdminMode()
    }

    private async refreshAdminMode(): Promise<void> {
        try {
            this.adoptAdminMode(await this.api.getAdminMode())
        } catch (error) {
            console.error('Could not read Admin Mode', error)
        }
    }

    private adoptAdminMode(expiresAt: Date | undefined) {
        clearTimeout(this.adminModeExpiryTimer)
        this.adminModeExpiryTimer = undefined
        this.adminModeClock = Date.now()
        this.adminModeExpiresAt = expiresAt
        if (expiresAt === undefined) {
            return
        }
        const remaining = expiresAt.getTime() - this.adminModeClock
        if (remaining <= 0) {
            return
        }
        this.adminModeExpiryTimer = setTimeout(() => {
            this.adminModeClock = Date.now()
        }, remaining)
    }

    public getSessionUser(): User | undefined {
        return this.sessionUser
    }

    public setSessionUser(user: User) {
        this.sessionUser = user
        writeStoredValue(AuthorizationService.storageKey, user)
        this.onSessionUserSet()
    }

    public clearSessionUser() {
        this.sessionUser = undefined
        this.adoptAdminMode(undefined)
        removeStoredValue(AuthorizationService.storageKey)
        this.onSessionUserCleared()
    }

    public async onLogin(user: User) {
        this.adoptSessionUser(user)

        if (user.status === UserStatus.Incomplete) {
            await goto('/onboarding')
            return
        }
        await goto(takeLoginContinuation() ?? '/library')
    }

    public async onLogout() {
        clearLoginContinuation()
        this.clearSessionUser()
        await goto('/')
    }

    private async loadSessionUser() {
        const sessionUser = await this.fetchSessionUser()
        if (sessionUser) {
            this.adoptSessionUser(sessionUser)
        }
    }

    private async verifyStoredSessionUser(storedUser: User): Promise<boolean> {
        const sessionUser = await this.fetchSessionUser()
        if (sessionUser) {
            this.adoptSessionUser(sessionUser)
        } else {
            this.clearSessionUser()
        }
        return sessionUser?.id !== storedUser.id || sessionUser.status !== storedUser.status
    }

    private adoptSessionUser(user: User) {
        this.setSessionUser(user)
        void this.fillMissingTimeZone(user)
        if (user.roles.includes(Role.Admin)) {
            void this.refreshAdminMode()
        } else {
            this.adoptAdminMode(undefined)
        }
    }

    private async fillMissingTimeZone(user: User) {
        if (user.timeZone) {
            return
        }
        try {
            const updatedUser = await this.api.updateUserTimeZone(browserTimeZone(), {
                onlyIfUnset: true
            })
            if (this.sessionUser?.id === updatedUser.id) {
                this.setSessionUser(updatedUser)
            }
        } catch (error) {
            console.error('Could not save the browser time zone', error)
        }
    }

    private async fetchSessionUser(): Promise<User | undefined> {
        try {
            const sessionUser = await this.api.getSelf()
            if (sessionUser && canHoldAuthenticatedSession(sessionUser)) {
                return sessionUser
            }
        } catch {
            // do nothing
        }
        return undefined
    }

    private redirect(user?: User) {
        switch (user?.status) {
            case UserStatus.Incomplete:
                redirect(302, '/onboarding')
                break
            case UserStatus.Active:
                redirect(302, takeLoginContinuation() ?? '/activeGamesCheck')
                break
            default:
                redirect(302, '/login')
                break
        }
    }
}
