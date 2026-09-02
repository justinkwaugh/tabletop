import { describe, expect, it } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { TabletopApi } from '@tabletop/frontend-components'
import { AuthorizationService } from './authorizationService.svelte.js'

function createUser(roles: Role[]): User {
    return {
        id: 'user-id',
        status: UserStatus.Active,
        roles,
        externalIds: []
    }
}

describe('AuthorizationService developer tools', () => {
    it.each([
        { roles: [Role.Developer], expected: true },
        { roles: [Role.Admin], expected: true },
        { roles: [Role.User], expected: false }
    ])('allows developer tools for $roles', ({ roles, expected }) => {
        const service = new AuthorizationService(new TabletopApi())
        service.setSessionUser(createUser(roles))

        expect(service.canUseDeveloperTools).toBe(expected)

        service.debugViewEnabled = true
        expect(service.showDebug).toBe(expected)
    })

    it('does not grant admin capabilities to a developer', () => {
        const service = new AuthorizationService(new TabletopApi())
        service.setSessionUser(createUser([Role.Developer]))
        service.adminCapabilitiesEnabled = true

        expect(service.isDeveloper).toBe(true)
        expect(service.isAdmin).toBe(false)
        expect(service.actAsAdmin).toBe(false)
    })
})
