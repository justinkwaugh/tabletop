import { describe, expect, it, vi } from 'vitest'
import { ExternalAuthService, Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from './userService.js'
import { AccountUnavailableError, InvalidTimeZoneError } from './errors.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import type { StoredUser } from '../persistence/model/storedUser.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import { SessionService } from '../sessions/sessionService.js'
import { MemorySessionStore } from '../persistence/memory/sessionStore.js'

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
    const service = new UserService(
        store,
        TokenService.prototype,
        LocalTaskService.prototype,
        SessionService.prototype
    )
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
        const service = new UserService(
            store,
            TokenService.prototype,
            LocalTaskService.prototype,
            SessionService.prototype
        )
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

describe('sessions after a Password Credential change', () => {
    function passwordFixture() {
        const sessionStore = new MemorySessionStore()
        const sessions = new SessionService(sessionStore)
        const store: UserStore = Object.create(null)
        store.updateUser = async ({ fields, password }) => {
            const stored: StoredUser = { ...user, createdAt: undefined, updatedAt: undefined }
            const updatedFields = [...Object.keys(fields), ...(password ? ['password'] : [])]
            return [{ ...user, ...fields }, updatedFields, stored]
        }
        store.updatePassword = async () => {}
        const tasks: TaskService = Object.create(null)
        tasks.sendAccountChangeNotificationEmail = async () => {}
        const service = new UserService(store, TokenService.prototype, tasks, sessions)
        return { service, sessions, sessionStore }
    }

    it('revokes every session when the password is changed through an update', async () => {
        const { service, sessions, sessionStore } = passwordFixture()
        await sessions.establish(user)
        await sessions.establish(user)
        await service.updateUser('a', {}, 'a-new-password-value', 'the-current-password')
        expect(sessionStore.size).toBe(0)
    })

    it('revokes every session when the password is set', async () => {
        const { service, sessions, sessionStore } = passwordFixture()
        await sessions.establish(user)
        await service.updatePassword('a', 'a-new-password-value')
        expect(sessionStore.size).toBe(0)
    })

    it('keeps sessions through an update that leaves the password alone', async () => {
        const { service, sessions, sessionStore } = passwordFixture()
        await sessions.establish(user)
        await service.updateUser('a', { username: 'Renamed' })
        expect(sessionStore.size).toBe(1)
    })
})
