import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { TabletopApi } from '@tabletop/frontend-components'
import { AuthorizationService } from './authorizationService.svelte.js'
import { stubLocalStorage } from '$lib/test/localStorageStub'

vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }))

beforeEach(() => {
    stubLocalStorage()
})

function createUser(roles: Role[]): User {
    return {
        id: 'user-id',
        status: UserStatus.Active,
        roles,
        externalIds: []
    }
}

describe('AuthorizationService Admin Mode', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'))
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    function adminService(api = new TabletopApi()) {
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        service.setSessionUser(createUser([Role.User, Role.Admin]))
        return service
    }

    it('is off for an Administrator until the server confirms activation', async () => {
        const api = new TabletopApi()
        const expiresAt = new Date('2026-10-27T12:15:00.000Z')
        const activate = vi.spyOn(api, 'activateAdminMode').mockResolvedValue(expiresAt)
        const service = adminService(api)
        expect(service.isAdmin).toBe(true)
        expect(service.adminCapabilitiesEnabled).toBe(false)
        expect(service.actAsAdmin).toBe(false)

        await service.requestAdminMode()

        expect(activate).toHaveBeenCalledTimes(1)
        expect(service.adminCapabilitiesEnabled).toBe(true)
        expect(service.actAsAdmin).toBe(true)
    })

    it('ends when the server-reported expiry passes, without asking the server again', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        const status = vi.spyOn(api, 'getAdminMode')
        const service = adminService(api)
        await service.requestAdminMode()
        expect(service.actAsAdmin).toBe(true)

        vi.advanceTimersByTime(15 * 60 * 1000 - 1)
        expect(service.actAsAdmin).toBe(true)
        vi.advanceTimersByTime(1)
        expect(service.actAsAdmin).toBe(false)
        expect(status).not.toHaveBeenCalled()
    })

    it('ends once the server confirms the deactivation, not before', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        let settle: () => void = () => {}
        const deactivate = vi.spyOn(api, 'deactivateAdminMode').mockReturnValue(
            new Promise((resolve) => {
                settle = resolve
            })
        )
        const service = adminService(api)
        await service.requestAdminMode()

        const pending = service.deactivateAdminMode()
        expect(service.actAsAdmin).toBe(true)
        settle()
        await pending
        expect(deactivate).toHaveBeenCalledTimes(1)
        expect(service.actAsAdmin).toBe(false)
    })

    it('keeps the mode the server last confirmed when a deactivation never reaches it, and asks again', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        vi.spyOn(api, 'deactivateAdminMode').mockRejectedValue(
            new Error('request never reached the server')
        )
        const status = vi
            .spyOn(api, 'getAdminMode')
            .mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        const service = adminService(api)
        await service.requestAdminMode()

        await expect(service.deactivateAdminMode()).rejects.toThrow(
            'request never reached the server'
        )
        expect(status).toHaveBeenCalledTimes(1)
        expect(service.actAsAdmin).toBe(true)

        status.mockResolvedValue(undefined)
        await expect(service.deactivateAdminMode()).rejects.toThrow()
        expect(service.actAsAdmin).toBe(false)
    })

    it('keeps the last confirmed mode when neither the deactivation nor the check reaches the server', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        vi.spyOn(api, 'deactivateAdminMode').mockRejectedValue(new Error('offline'))
        vi.spyOn(api, 'getAdminMode').mockRejectedValue(new Error('offline'))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const service = adminService(api)
        await service.requestAdminMode()

        await expect(service.deactivateAdminMode()).rejects.toThrow('offline')
        expect(service.actAsAdmin).toBe(true)
    })

    it('ignores an older status answer that arrives after a later request ended the mode', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'getSelf').mockResolvedValue(createUser([Role.User, Role.Admin]))
        let answerStatus: (expiresAt: Date | undefined) => void = () => {}
        vi.spyOn(api, 'getAdminMode').mockReturnValue(
            new Promise((resolve) => {
                answerStatus = resolve
            })
        )
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        vi.spyOn(api, 'deactivateAdminMode').mockResolvedValue(undefined)
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        await service.initialize()
        expect(service.actAsAdmin).toBe(false)

        await service.requestAdminMode()
        expect(service.actAsAdmin).toBe(true)
        await service.deactivateAdminMode()
        expect(service.actAsAdmin).toBe(false)

        answerStatus(new Date('2026-10-27T12:14:00.000Z'))
        await vi.advanceTimersByTimeAsync(0)
        expect(service.actAsAdmin).toBe(false)
    })

    it('gives an Administrator without the Developer role developer tools only while in Admin Mode', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        const service = adminService(api)
        service.debugViewEnabled = true
        expect(service.canUseDeveloperTools).toBe(false)
        expect(service.showDebug).toBe(false)

        await service.requestAdminMode()
        expect(service.canUseDeveloperTools).toBe(true)
        expect(service.showDebug).toBe(true)

        vi.advanceTimersByTime(15 * 60 * 1000)
        expect(service.actAsAdmin).toBe(false)
        expect(service.canUseDeveloperTools).toBe(false)
        expect(service.showDebug).toBe(false)
    })

    it('withdraws developer tools from an Administrator when the server confirms deactivation', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        vi.spyOn(api, 'deactivateAdminMode').mockResolvedValue(undefined)
        const service = adminService(api)
        service.debugViewEnabled = true
        await service.requestAdminMode()
        expect(service.showDebug).toBe(true)

        await service.deactivateAdminMode()
        expect(service.canUseDeveloperTools).toBe(false)
        expect(service.showDebug).toBe(false)
    })

    it('keeps developer tools for the Developer role whatever Admin Mode does', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'activateAdminMode').mockResolvedValue(new Date('2026-10-27T12:15:00.000Z'))
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        service.setSessionUser(createUser([Role.User, Role.Admin, Role.Developer]))
        service.debugViewEnabled = true
        expect(service.canUseDeveloperTools).toBe(true)
        expect(service.showDebug).toBe(true)

        await service.requestAdminMode()
        vi.advanceTimersByTime(15 * 60 * 1000)
        expect(service.actAsAdmin).toBe(false)
        expect(service.canUseDeveloperTools).toBe(true)
        expect(service.showDebug).toBe(true)
    })

    it('never activates on its own when the person reauthenticates for something else', async () => {
        const api = new TabletopApi()
        const activate = vi.spyOn(api, 'activateAdminMode')
        vi.spyOn(api, 'reauthenticateWithPassword').mockResolvedValue(undefined)
        const service = adminService(api)
        await api.reauthenticateWithPassword('password')
        expect(activate).not.toHaveBeenCalled()
        expect(service.actAsAdmin).toBe(false)
    })

    it('mirrors the mode the server holds when the session is restored', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'getSelf').mockResolvedValue(createUser([Role.User, Role.Admin]))
        const status = vi
            .spyOn(api, 'getAdminMode')
            .mockResolvedValue(new Date('2026-10-27T12:10:00.000Z'))
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        await service.initialize()
        await vi.waitFor(() => expect(service.actAsAdmin).toBe(true))
        expect(status).toHaveBeenCalledTimes(1)

        service.clearSessionUser()
        expect(service.actAsAdmin).toBe(false)
    })

    it('does not consult the server for an ordinary restored session', async () => {
        const api = new TabletopApi()
        vi.spyOn(api, 'getSelf').mockResolvedValue(createUser([Role.User]))
        const status = vi.spyOn(api, 'getAdminMode')
        const service = new AuthorizationService(api, vi.fn(), vi.fn())
        await service.initialize()
        expect(status).not.toHaveBeenCalled()
        expect(service.actAsAdmin).toBe(false)
    })
})
