import { describe, expect, it, vi } from 'vitest'
import { ExternalAuthService, Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from './userService.js'
import { AccountUnavailableError, InvalidPasswordError, InvalidTimeZoneError } from './errors.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import type { StoredUser } from '../persistence/model/storedUser.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'

const user: User = {
    id: 'a',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

function fixture(existing: User = user) {
    const updateUser = vi.fn<UserStore['updateUser']>(async ({ fields, validator }) => {
        const stored: StoredUser = {
            ...existing,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt
        }
        if (validator?.(stored, fields) === UpdateValidationResult.Cancel) {
            return [existing, [], existing]
        }
        return [{ ...existing, ...fields }, Object.keys(fields), existing]
    })
    const store: UserStore = Object.create(null)
    store.updateUser = updateUser
    const service = new UserService(store, TokenService.prototype, LocalTaskService.prototype)
    return { service, updateUser }
}

describe('user time zone', () => {
    it('stores a known time zone', async () => {
        const { service, updateUser } = fixture()
        await expect(service.updateUserTimeZone('a', 'America/Chicago')).resolves.toEqual(
            expect.objectContaining({ timeZone: 'America/Chicago' })
        )
        expect(updateUser).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ userId: 'a', fields: { timeZone: 'America/Chicago' } })
        )
    })

    it('rejects an unknown time zone', async () => {
        const { service, updateUser } = fixture()
        await expect(service.updateUserTimeZone('a', 'Mars/Olympus_Mons')).rejects.toThrow(
            InvalidTimeZoneError
        )
        expect(updateUser).not.toHaveBeenCalled()
    })

    it('fills an empty time zone without replacing one already chosen', async () => {
        const empty = fixture()
        await expect(
            empty.service.updateUserTimeZone('a', 'America/Chicago', { onlyIfUnset: true })
        ).resolves.toEqual(expect.objectContaining({ timeZone: 'America/Chicago' }))

        const chosen = fixture({ ...user, timeZone: 'Europe/London' })
        await expect(
            chosen.service.updateUserTimeZone('a', 'America/Chicago', { onlyIfUnset: true })
        ).resolves.toEqual(expect.objectContaining({ timeZone: 'Europe/London' }))
        await expect(chosen.service.updateUserTimeZone('a', 'America/Chicago')).resolves.toEqual(
            expect.objectContaining({ timeZone: 'America/Chicago' })
        )
    })
})

describe('external provider authentication', () => {
    function providerFixture(linked?: User, byEmail?: User) {
        const addExternalId = vi.fn<UserStore['addExternalId']>(async ({ userId, externalId }) => ({
            ...(byEmail ?? user),
            id: userId,
            externalIds: [`google:${externalId}`]
        }))
        const createUser = vi.fn<UserStore['createUser']>(async (created) => created)
        const store: UserStore = Object.create(null)
        store.findByExternalId = async () => linked
        store.findByEmail = async () => byEmail
        store.addExternalId = addExternalId
        store.createUser = createUser
        const service = new UserService(store, TokenService.prototype, LocalTaskService.prototype)
        return { service, addExternalId, createUser }
    }

    const request = {
        service: ExternalAuthService.Google,
        externalId: 'g-1',
        email: 'person@example.test',
        emailVerified: true
    }

    it('returns a linked Active or Incomplete Account', async () => {
        for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
            const { service } = providerFixture({ ...user, status })
            await expect(service.handleExternalAuth(request)).resolves.toMatchObject({ status })
        }
    })

    it('refuses a linked Inactive or Deleted Account', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const { service, createUser } = providerFixture({ ...user, status })
            await expect(service.handleExternalAuth(request)).rejects.toThrow(
                AccountUnavailableError
            )
            expect(createUser).not.toHaveBeenCalled()
        }
    })

    it('links a trusted verified email to an Active Account', async () => {
        const { service, addExternalId } = providerFixture(undefined, {
            ...user,
            email: request.email,
            emailVerified: true
        })
        await expect(service.handleExternalAuth(request)).resolves.toMatchObject({ id: 'a' })
        expect(addExternalId).toHaveBeenCalledExactlyOnceWith({
            userId: 'a',
            externalId: 'g-1',
            service: ExternalAuthService.Google
        })
    })

    it('neither links nor authenticates an Inactive or Deleted Account by email', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const { service, addExternalId, createUser } = providerFixture(undefined, {
                ...user,
                status,
                email: request.email,
                emailVerified: true
            })
            await expect(service.handleExternalAuth(request)).rejects.toThrow(
                AccountUnavailableError
            )
            expect(addExternalId).not.toHaveBeenCalled()
            expect(createUser).not.toHaveBeenCalled()
        }
    })
})

describe('Password Credential changes', () => {
    function passwordFixture() {
        const updatePassword = vi.fn<UserStore['updatePassword']>(async () => ({
            ...user,
            sessionGeneration: 1
        }))
        const store: UserStore = Object.create(null)
        store.updatePassword = updatePassword
        store.updateUser = async ({ fields, password }) => {
            const stored: StoredUser = { ...user, createdAt: undefined, updatedAt: undefined }
            const updatedFields = [...Object.keys(fields), ...(password ? ['password'] : [])]
            return [{ ...user, ...fields, sessionGeneration: 1 }, updatedFields, stored]
        }
        const tasks: TaskService = Object.create(null)
        tasks.sendAccountChangeNotificationEmail = async () => {}
        const service = new UserService(store, TokenService.prototype, tasks)
        return { service, updatePassword }
    }

    it('returns the Account as the store committed it, Session Generation included', async () => {
        const { service, updatePassword } = passwordFixture()
        await expect(service.updatePassword('a', '  a-new-password-value  ')).resolves.toEqual(
            expect.objectContaining({ id: 'a', sessionGeneration: 1 })
        )
        expect(updatePassword).toHaveBeenCalledExactlyOnceWith('a', 'a-new-password-value')
        await expect(
            service.updateUser('a', {}, 'a-new-password-value', 'the-current-password')
        ).resolves.toEqual(expect.objectContaining({ id: 'a', sessionGeneration: 1 }))
    })

    it('refuses a short password before reaching the store', async () => {
        const { service, updatePassword } = passwordFixture()
        await expect(service.updatePassword('a', 'short')).rejects.toThrow(InvalidPasswordError)
        expect(updatePassword).not.toHaveBeenCalled()
    })
})
