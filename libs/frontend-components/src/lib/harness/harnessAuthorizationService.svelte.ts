import type {
    AuthorizationCategory,
    AuthorizationService
} from '$lib/services/authorizationService.js'
import { hasDeveloperAccess, Role, UserStatus, type User } from '@tabletop/common'

export class HarnessAuthorizationService implements AuthorizationService {
    public sessionUser: User = $state({
        id: 'harness-user',
        username: 'Developer',
        roles: [Role.User, Role.Developer, Role.Admin],
        status: UserStatus.Active,
        externalIds: []
    })
    public isAdmin: boolean = $derived(this.sessionUser.roles.includes(Role.Admin))
    public isDeveloper: boolean = $derived(this.sessionUser.roles.includes(Role.Developer))
    public debugViewEnabled: boolean = $state(false)
    public adminCapabilitiesEnabled: boolean = $state(false)
    public actAsAdmin: boolean = $derived(this.isAdmin && this.adminCapabilitiesEnabled)
    public canUseDeveloperTools: boolean = $derived(
        hasDeveloperAccess({ user: this.sessionUser, adminMode: this.actAsAdmin })
    )
    public showDebug: boolean = $derived(this.canUseDeveloperTools && this.debugViewEnabled)

    async initialize() {}

    async requestAdminMode() {
        this.adminCapabilitiesEnabled = true
    }

    async deactivateAdminMode() {
        this.adminCapabilitiesEnabled = false
    }

    async authorizeRoute(_args: {
        category: AuthorizationCategory
        intendedUrl: URL
    }): Promise<boolean> {
        return true
    }

    getSessionUser(): User | undefined {
        return this.sessionUser
    }
    setSessionUser(user: User) {
        this.sessionUser = user
    }
    clearSessionUser() {}
    async onLogin(_user: User) {}
    async onLogout() {}
}
