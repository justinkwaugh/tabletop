import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertExists, Role, UserStatus, type User } from '@tabletop/common'
import { APIError, TabletopApi } from '@tabletop/frontend-components'
import { goto, invalidateAll } from '$app/navigation'
import { AuthorizationService } from './authorizationService.svelte.js'
import { stubLocalStorage, stubSessionStorage } from '$lib/test/localStorageStub'
import { reauthentication } from '$lib/stores/reauthentication.svelte'
import { signInWithGoogle } from '$lib/utils/googleSignIn'

vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }))

beforeEach(() => {
    stubLocalStorage()
    stubSessionStorage()
    vi.mocked(invalidateAll).mockClear()
    reauthentication.cancel()
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
        { roles: [Role.Admin, Role.Developer], expected: true },
        { roles: [Role.Admin], expected: false },
        { roles: [Role.User], expected: false }
    ])('allows developer tools outside Admin Mode for $roles', ({ roles, expected }) => {
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn())
        service.setSessionUser(createUser(roles))

        expect(service.canUseDeveloperTools).toBe(expected)

        service.debugViewEnabled = true
        expect(service.showDebug).toBe(expected)
    })

    it('does not grant admin capabilities to a developer', async () => {
        const api = new TabletopApi()
        const activate = vi
            .spyOn(api, 'activateAdminMode')
            .mockResolvedValue(new Date(Date.now() + 60_000))
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        service.setSessionUser(createUser([Role.Developer]))
        await service.requestAdminMode()

        expect(service.isDeveloper).toBe(true)
        expect(service.isAdmin).toBe(false)
        expect(service.adminCapabilitiesEnabled).toBe(false)
        expect(service.actAsAdmin).toBe(false)
        expect(activate).not.toHaveBeenCalled()
    })
})

describe('AuthorizationService session lifecycle', () => {
    it('cannot replay a saved Google link after logout and another account signs in', async () => {
        const api = new TabletopApi()
        const first = { ...createUser([Role.User]), id: 'first', timeZone: 'UTC' }
        const second = { ...createUser([Role.User]), id: 'second', timeZone: 'UTC' }
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        service.setSessionUser(first)
        const link = vi
            .spyOn(api, 'linkGoogle')
            .mockRejectedValueOnce(
                new APIError({
                    name: 'RecentAuthenticationRequiredError',
                    message: 'Confirm your identity'
                })
            )
            .mockResolvedValue(first)
        await signInWithGoogle({
            credential: 'first-account-credential',
            mode: 'link',
            api,
            session: service,
            report: vi.fn()
        })
        const pending = reauthentication.pending
        assertExists(pending, 'Google linking requested confirmation')
        await service.onLogout()
        await service.onLogin(second)
        await reauthentication.complete(pending)
        expect(link).toHaveBeenCalledTimes(1)
        expect(service.getSessionUser()?.id).toBe(second.id)
    })

    it('cancels confirmation when another account is adopted', () => {
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn())
        service.setSessionUser(createUser([Role.User]))
        reauthentication.request({ description: 'link Google', retry: vi.fn() })
        service.setSessionUser({ ...createUser([Role.User]), id: 'another-user' })
        expect(reauthentication.pending).toBeUndefined()
    })

    it('cancels confirmation on a new login to the same account', async () => {
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn())
        const user = { ...createUser([Role.User]), timeZone: 'UTC' }
        service.setSessionUser(user)
        reauthentication.request({ description: 'link Google', retry: vi.fn() })
        await service.onLogin(user)
        expect(reauthentication.pending).toBeUndefined()
    })

    it('keeps confirmation during a profile refresh for the same account', () => {
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn())
        const user = createUser([Role.User])
        service.setSessionUser(user)
        reauthentication.request({ description: 'link Google', retry: vi.fn() })
        const pending = reauthentication.pending
        service.setSessionUser({ ...user, timeZone: 'UTC' })
        expect(reauthentication.pending).toBe(pending)
    })

    it('does not reopen confirmation when an old request is refused after logout', async () => {
        const service = new AuthorizationService(new TabletopApi(), vi.fn(), vi.fn())
        service.setSessionUser(createUser([Role.User]))
        const response = Promise.withResolvers<void>()
        const request = reauthentication.run({
            description: 'link Google',
            retry: () => response.promise
        })
        service.clearSessionUser()
        response.reject(
            new APIError({
                name: 'RecentAuthenticationRequiredError',
                message: 'Confirm your identity'
            })
        )
        await request
        expect(reauthentication.pending).toBeUndefined()
    })

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

    it('forgets the user before the session ends when signing out', async () => {
        const api = new TabletopApi()
        let endSession: () => void = () => {}
        vi.spyOn(api, 'logout').mockReturnValue(
            new Promise((resolve) => {
                endSession = resolve
            })
        )
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        service.setSessionUser(createUser([Role.User]))

        const signingOut = service.logout()
        expect(service.getSessionUser()).toBeUndefined()
        expect(api.logout).toHaveBeenCalledTimes(1)

        endSession()
        await signingOut
        expect(goto).toHaveBeenCalledWith('/')
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
