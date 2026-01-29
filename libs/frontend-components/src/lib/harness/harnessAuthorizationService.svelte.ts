import type {
    AuthorizationCategory,
    AuthorizationService
} from '$lib/services/authorizationService.js'
import { Role, UserStatus, type User } from '@tabletop/common'

export class HarnessAuthorizationService implements AuthorizationService {
    public isAdmin: boolean = true
    public debugViewEnabled: boolean = $state(false)
    public adminCapabilitiesEnabled: boolean = $state(false)
    public showDebug: boolean = $derived(this.isAdmin && this.debugViewEnabled)
    public actAsAdmin: boolean = $derived(this.isAdmin && this.adminCapabilitiesEnabled)

    async initialize() {}

    async authorizeRoute({
        category: _category,
        intendedUrl: _intendedUrl
    }: {
        category: AuthorizationCategory
        intendedUrl: URL
    }): Promise<boolean> {
        return true
    }

    getSessionUser(): User | undefined {
        return {
            id: 'harness-user',
            username: 'Developer',
            roles: [Role.User, Role.Admin],
            status: UserStatus.Active,
            externalIds: []
        }
    }
    setSessionUser(_user: User) {}
    clearSessionUser() {}
    async onLogin(_user: User) {}
    async onLogout() {}
}
