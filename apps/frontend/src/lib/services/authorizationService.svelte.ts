import { Role, User, UserStatus } from '@tabletop/common'
import * as Value from 'typebox/value'
import { goto, invalidateAll } from '$app/navigation'
import { redirect } from '@sveltejs/kit'
import { AuthorizationCategory, type TabletopApi } from '@tabletop/frontend-components'
import {
    clearLoginContinuation,
    saveLoginContinuation,
    takeLoginContinuation
} from '$lib/utils/loginContinuation'

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

    isAdmin: boolean = $derived(Boolean(this.sessionUser?.roles.includes(Role.Admin)))
    isDeveloper: boolean = $derived(Boolean(this.sessionUser?.roles.includes(Role.Developer)))
    canUseDeveloperTools: boolean = $derived(this.isAdmin || this.isDeveloper)
    debugViewEnabled: boolean = $state(false)
    adminCapabilitiesEnabled: boolean = $state(false)

    showDebug: boolean = $derived(this.canUseDeveloperTools && this.debugViewEnabled)
    actAsAdmin: boolean = $derived(this.isAdmin && this.adminCapabilitiesEnabled)

    constructor(
        private api: TabletopApi,
        private readonly onSessionUserSet: () => void
    ) {}

    public async initialize(): Promise<void> {
        if (this.initialized) {
            return
        }

        const storedUser = this.readStoredSessionUser()
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

    public getSessionUser(): User | undefined {
        return this.sessionUser
    }

    public setSessionUser(user: User) {
        this.sessionUser = user
        localStorage.setItem(AuthorizationService.storageKey, JSON.stringify(user))
        this.onSessionUserSet()
    }

    public clearSessionUser() {
        this.sessionUser = undefined
        localStorage.removeItem(AuthorizationService.storageKey)
    }

    public async onLogin(user: User) {
        this.setSessionUser(user)

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
            this.setSessionUser(sessionUser)
        }
    }

    private async verifyStoredSessionUser(storedUser: User): Promise<boolean> {
        const sessionUser = await this.fetchSessionUser()
        if (sessionUser) {
            this.setSessionUser(sessionUser)
        } else {
            this.clearSessionUser()
        }
        return sessionUser?.id !== storedUser.id || sessionUser.status !== storedUser.status
    }

    private async fetchSessionUser(): Promise<User | undefined> {
        try {
            const sessionUser = await this.api.getSelf()
            if (
                sessionUser &&
                sessionUser.status !== UserStatus.Deleted &&
                sessionUser.status !== UserStatus.Inactive
            ) {
                return sessionUser
            }
        } catch {
            // do nothing
        }
        return undefined
    }

    private readStoredSessionUser(): User | undefined {
        const stored = localStorage.getItem(AuthorizationService.storageKey)
        if (!stored) {
            return undefined
        }
        try {
            const storedUser = Value.Convert(User, JSON.parse(stored))
            return Value.Check(User, storedUser) ? storedUser : undefined
        } catch {
            return undefined
        }
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
