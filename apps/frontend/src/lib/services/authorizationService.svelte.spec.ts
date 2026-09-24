import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { TabletopApi } from '@tabletop/frontend-components'
import { invalidateAll } from '$app/navigation'
import { AuthorizationService } from './authorizationService.svelte.js'
import { stubLocalStorage } from '$lib/test/localStorageStub'

vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }))

beforeEach(() => {
    stubLocalStorage()
    vi.mocked(invalidateAll).mockClear()
})

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
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn())
        service.setSessionUser(createUser(roles))

        expect(service.canUseDeveloperTools).toBe(expected)

        service.debugViewEnabled = true
        expect(service.showDebug).toBe(expected)
    })

    it('does not grant admin capabilities to a developer', () => {
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn())
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
        const service = new AuthorizationService(new TabletopApi(), onSessionUserSet, vi.fn())
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
            const service = new AuthorizationService(api, onSessionUserSet, vi.fn())
            await Promise.all([service.initialize(), service.initialize()])
            expect(onSessionUserSet).toHaveBeenCalledTimes(signedIn ? 1 : 0)
            expect(api.getSelf).toHaveBeenCalledTimes(1)
        }
    )
})

describe('AuthorizationService stored session user', () => {
    function storeUser(user: User) {
        new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn()).setSessionUser(user)
    }

    function pendingSelf(api: TabletopApi) {
        let resolveSelf: (user: User | undefined) => void = () => {}
        vi.spyOn(api, 'getSelf').mockReturnValue(
            new Promise((resolve) => {
                resolveSelf = resolve
            })
        )
        return (user: User | undefined) => resolveSelf(user)
    }

    it('initializes from the stored user without waiting for the server', async () => {
        storeUser(createUser([Role.User]))
        const api = new TabletopApi()
        pendingSelf(api)
        const service = new AuthorizationService(api, vi.fn(), vi.fn())

        await service.initialize()

        expect(service.getSessionUser()?.id).toBe('user-id')
        expect(api.getSelf).toHaveBeenCalledTimes(1)
    })

    it('keeps an unchanged session without rerunning route loads', async () => {
        storeUser(createUser([Role.User]))
        const api = new TabletopApi()
        const resolveSelf = pendingSelf(api)
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        await service.initialize()

        resolveSelf(createUser([Role.User, Role.Admin]))
        await service.whenSessionVerified()

        expect(service.isAdmin).toBe(true)
        expect(invalidateAll).not.toHaveBeenCalled()
    })

    it('clears an expired session and reruns route loads', async () => {
        storeUser(createUser([Role.User]))
        const api = new TabletopApi()
        const resolveSelf = pendingSelf(api)
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        await service.initialize()

        resolveSelf(undefined)
        await service.whenSessionVerified()

        expect(service.getSessionUser()).toBeUndefined()
        expect(localStorage.getItem('sessionUser')).toBeNull()
        await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalledTimes(1))
    })

    it('reruns route loads when the verified status differs', async () => {
        storeUser(createUser([Role.User]))
        const api = new TabletopApi()
        const resolveSelf = pendingSelf(api)
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        await service.initialize()

        resolveSelf({ ...createUser([Role.User]), status: UserStatus.Incomplete })
        await service.whenSessionVerified()

        expect(service.getSessionUser()?.status).toBe(UserStatus.Incomplete)
        await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalledTimes(1))
    })

    it('waits for the server when the stored user is unreadable', async () => {
        localStorage.setItem('sessionUser', '{"id":1}')
        const api = new TabletopApi()
        const resolveSelf = pendingSelf(api)
        const service = new AuthorizationService(api, vi.fn(), vi.fn())

        const initialization = service.initialize()
        expect(service.getSessionUser()).toBeUndefined()
        resolveSelf(createUser([Role.User]))
        await initialization

        expect(service.getSessionUser()?.id).toBe('user-id')
    })

    it('forgets the stored user and notifies when the session is cleared', () => {
        const onSessionUserCleared = vi.fn()
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), onSessionUserCleared)
        service.setSessionUser(createUser([Role.User]))

        service.clearSessionUser()

        expect(localStorage.getItem('sessionUser')).toBeNull()
        expect(onSessionUserCleared).toHaveBeenCalledTimes(1)
    })
})
