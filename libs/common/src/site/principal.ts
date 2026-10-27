import { Role, UserStatus, type User } from './user.js'

export type Principal = {
    readonly user: User
    readonly adminMode: boolean
}

export function isAdministrator(user: Pick<User, 'status' | 'roles'>): boolean {
    return user.status === UserStatus.Active && user.roles.includes(Role.Admin)
}

export function ordinaryPrincipal(user: User): Principal {
    return { user, adminMode: false }
}

export function hasDeveloperAccess(principal: Principal | undefined): boolean {
    if (!principal) {
        return false
    }
    return principal.adminMode || principal.user.roles.includes(Role.Developer)
}
