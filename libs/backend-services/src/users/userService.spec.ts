import { TokenType } from '../tokens/dataToken.js'
import { describe, expect, it, vi } from 'vitest'
import { ExternalAuthService, Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from './userService.js'
import { AccountUnavailableError, InvalidPasswordError, InvalidTimeZoneError } from './errors.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import type { StoredUser } from '../persistence/model/storedUser.js'
import type { Transaction } from '@google-cloud/firestore'
import { TokenService } from '../tokens/tokenService.js'
import { InvalidChallengeError } from '../tokens/authenticationChallenge.js'
import { MemoryTokenStore } from '../persistence/memory/tokenStore.js'
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
    const transitionAccountStatus = vi.fn<UserStore['transitionAccountStatus']>(
        async (_userId, transition) => ({
            ...existing,
            status: transition === 'deactivate' ? UserStatus.Inactive : UserStatus.Active
        })
    )
    const store: UserStore = Object.create(null)
    store.updateUser = updateUser
    store.transitionAccountStatus = transitionAccountStatus
    const service = new UserService(store, TokenService.prototype, LocalTaskService.prototype)
    return { service, updateUser, transitionAccountStatus }
}

describe('account status transitions', () => {
    it('applies the transition through the store, apart from profile updates', async () => {
        const { service, updateUser, transitionAccountStatus } = fixture()
        await expect(service.transitionAccountStatus('a', 'deactivate')).resolves.toEqual(
            expect.objectContaining({ id: 'a', status: UserStatus.Inactive })
        )
        expect(transitionAccountStatus).toHaveBeenCalledExactlyOnceWith('a', 'deactivate')
        expect(updateUser).not.toHaveBeenCalled()
    })
})

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
    const transaction: Transaction = Object.create(null)
    const locks = { addKeys: async () => {} }
    const account: User = { ...user, email: 'a@example.test', emailVerified: true }

    function passwordFixture(existing: User = account) {
        const challenges = new TokenService(new MemoryTokenStore())
        const updatePassword = vi.fn<UserStore['updatePassword']>(
            async (_userId, _password, options) => {
                const stored: StoredUser = {
                    ...existing,
                    createdAt: undefined,
                    updatedAt: undefined
                }
                options?.validate?.(stored)
                await options?.participant?.(transaction, locks)
                return { ...existing, sessionGeneration: 1 }
            }
        )
        const store: UserStore = Object.create(null)
        store.findById = async (id) => (id === existing.id ? existing : undefined)
        store.updatePassword = updatePassword
        store.updateUser = async ({ fields, password }) => {
            const stored: StoredUser = { ...existing, createdAt: undefined, updatedAt: undefined }
            const updatedFields = [...Object.keys(fields), ...(password ? ['password'] : [])]
            return [{ ...existing, ...fields, sessionGeneration: 1 }, updatedFields, stored]
        }
        const tasks: TaskService = Object.create(null)
        const notifications: unknown[] = []
        const resetMails: { userId: string; token: string }[] = []
        tasks.sendAccountChangeNotificationEmail = async (notification) => {
            notifications.push(notification)
        }
        tasks.sendPasswordResetEmail = async (mail) => {
            resetMails.push(mail)
        }
        const service = new UserService(store, challenges, tasks)
        const sessions = new SessionService(new MemorySessionStore())
        const updateProfile = async () =>
            service.updateUser(
                await sessions.establish(existing, 'authentication-method'),
                {},
                'a-new-password-value'
            )
        const issueReset = async () => {
            const issued = await challenges.issueChallenge({
                type: TokenType.PasswordReset,
                userId: existing.id,
                email: existing.email ?? ''
            })
            return issued.secret
        }
        return {
            service,
            updatePassword,
            updateProfile,
            issueReset,
            notifications,
            resetMails,
            tasks
        }
    }

    it('reports a committed reset even when its change notice cannot be queued', async () => {
        const { service, updatePassword, updateProfile, issueReset, notifications, tasks } =
            passwordFixture()
        tasks.sendAccountChangeNotificationEmail = async ({ email }) => {
            throw new Error(`synthetic queue rejection for ${email}`)
        }
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            const secret = await issueReset()
            await expect(
                service.setPassword({ userId: 'a', secret, password: 'a-new-password-value' })
            ).resolves.toEqual(expect.objectContaining({ id: 'a', sessionGeneration: 1 }))
            expect(updatePassword).toHaveBeenCalledOnce()
            await expect(
                service.setPassword({ userId: 'a', secret, password: 'a-new-password-value' })
            ).rejects.toThrow(InvalidChallengeError)
            await expect(updateProfile()).resolves.toEqual(
                expect.objectContaining({ id: 'a', sessionGeneration: 1 })
            )
            expect(notifications).toEqual([])
            expect(logged).toHaveBeenCalledTimes(2)
            const diagnostics = JSON.stringify(logged.mock.calls)
            expect(diagnostics).toContain('"changeType":"password"')
            expect(diagnostics).toContain('"userId":"a"')
            expect(diagnostics).not.toContain('a@example.test')
            expect(diagnostics).not.toContain(secret)
            expect(diagnostics).not.toContain('a-new-password-value')
        } finally {
            logged.mockRestore()
        }
    })

    it('returns the Account as the store committed it, Session Generation included', async () => {
        const { service, updatePassword, updateProfile, issueReset, notifications } =
            passwordFixture()
        const secret = await issueReset()
        await expect(
            service.setPassword({ userId: 'a', secret, password: '  a-new-password-value  ' })
        ).resolves.toEqual(expect.objectContaining({ id: 'a', sessionGeneration: 1 }))
        expect(updatePassword).toHaveBeenCalledExactlyOnceWith(
            'a',
            'a-new-password-value',
            expect.objectContaining({
                validate: expect.any(Function),
                participant: expect.any(Function)
            })
        )
        expect(notifications).toEqual([
            expect.objectContaining({ email: 'a@example.test', changeType: 'password' })
        ])
        await expect(updateProfile()).resolves.toEqual(
            expect.objectContaining({ id: 'a', sessionGeneration: 1 })
        )
    })

    it('refuses a short password before reaching the store', async () => {
        const { service, updatePassword, issueReset } = passwordFixture()
        const secret = await issueReset()
        await expect(
            service.setPassword({ userId: 'a', secret, password: 'short' })
        ).rejects.toThrow(InvalidPasswordError)
        expect(updatePassword).not.toHaveBeenCalled()
    })

    it('refuses a replayed, replaced or foreign Set Password Challenge inside the store transaction', async () => {
        const { service, issueReset, updatePassword } = passwordFixture()
        const first = await issueReset()
        const second = await issueReset()
        await expect(
            service.setPassword({ userId: 'a', secret: first, password: 'a-new-password-value' })
        ).rejects.toThrow(InvalidChallengeError)
        await expect(
            service.setPassword({ userId: 'a', secret: second, password: 'a-new-password-value' })
        ).resolves.toBeDefined()
        await expect(
            service.setPassword({ userId: 'a', secret: second, password: 'a-new-password-value' })
        ).rejects.toThrow(InvalidChallengeError)
        await expect(
            service.setPassword({ userId: 'b', secret: second, password: 'a-new-password-value' })
        ).rejects.toThrow(InvalidChallengeError)
        expect(updatePassword).toHaveBeenCalledTimes(3)
    })

    it('issues no Set Password Challenge for an Inactive or Deleted Account and says nothing', async () => {
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            const { service, resetMails } = passwordFixture({ ...account, status })
            await expect(
                service.sendPasswordResetEmail({ ...account, status })
            ).resolves.toBeUndefined()
            expect(resetMails).toEqual([])
        }
        for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
            const { service, resetMails } = passwordFixture({ ...account, status })
            const issued = await service.sendPasswordResetEmail({ ...account, status })
            expect(issued?.expiresAt).toBeInstanceOf(Date)
            expect(resetMails).toEqual([
                { userId: 'a', token: expect.stringMatching(/^a\.[2-9A-Za-z]{32}$/) }
            ])
        }
    })

    it('refuses Set Password once the Account can no longer hold a session', async () => {
        const { service, issueReset, updatePassword } = passwordFixture({
            ...account,
            status: UserStatus.Inactive
        })
        const secret = await issueReset()
        await expect(
            service.setPassword({ userId: 'a', secret, password: 'a-new-password-value' })
        ).rejects.toThrow(InvalidChallengeError)
        expect(updatePassword).not.toHaveBeenCalled()
    })
})
