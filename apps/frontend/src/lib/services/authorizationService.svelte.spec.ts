import { describe, expect, it, vi } from 'vitest'
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
        const service = new AuthorizationService(new TabletopApi(), vi.fn())
        service.setSessionUser(createUser(roles))

        expect(service.canUseDeveloperTools).toBe(expected)

        service.debugViewEnabled = true
        expect(service.showDebug).toBe(expected)
    })

    it('does not grant admin capabilities to a developer', () => {
        const service = new AuthorizationService(new TabletopApi(), vi.fn())
        service.setSessionUser(createUser([Role.Developer]))
        service.adminCapabilitiesEnabled = true

        expect(service.isDeveloper).toBe(true)
        expect(service.isAdmin).toBe(false)
        expect(service.actAsAdmin).toBe(false)
    })
})

describe('AuthorizationService session lifecycle', () => {
    it('notifies after establishing a session and after signing out and back in', () => {
        const onSessionUserSet = vi.fn()
        const service = new AuthorizationService(new TabletopApi(), onSessionUserSet)
        expect(onSessionUserSet).not.toHaveBeenCalled()
        service.setSessionUser(createUser([Role.User]))
        expect(onSessionUserSet).toHaveBeenCalledTimes(1)
        expect(service.getSessionUser()?.id).toBe('user-id')
        service.clearSessionUser()
        expect(onSessionUserSet).toHaveBeenCalledTimes(1)
        service.setSessionUser(createUser([Role.User]))
        expect(onSessionUserSet).toHaveBeenCalledTimes(2)
    })

    it.each([true, false])(
        'only notifies when session restoration finds a user: %s',
        async (signedIn) => {
            const api = new TabletopApi()
            vi.spyOn(api, 'getSelf').mockResolvedValue(
                signedIn ? createUser([Role.User]) : undefined
            )
            const onSessionUserSet = vi.fn()
            const service = new AuthorizationService(api, onSessionUserSet)
            await Promise.all([service.initialize(), service.initialize()])
            expect(onSessionUserSet).toHaveBeenCalledTimes(signedIn ? 1 : 0)
            expect(api.getSelf).toHaveBeenCalledTimes(1)
        }
    )
})
