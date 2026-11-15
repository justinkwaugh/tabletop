import { TokenType } from '../tokens/dataToken.js'
import { describe, expect, it, vi } from 'vitest'
import { ExternalAuthService, Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from './userService.js'
import {
    AccountModerationError,
    AccountUnavailableError,
    InvalidPasswordError,
    InvalidTimeZoneError,
    UsernameNotAllowedError
} from './errors.js'
import { AccountChangeType } from '../email/emailService.js'
import type { AuthenticatedSession } from '../sessions/authenticatedSession.js'
import { RecentAuthenticationRequiredError } from '../sessions/recentAuthentication.js'
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

describe('account moderation', () => {
    const session: AuthenticatedSession = {
        id: 'session',
        userId: 'a',
        generation: 0,
        createdAt: new Date(0),
        expiresAt: new Date(Date.now() + 60_000)
    }

    describe('username restrictions', () => {
        it('refuses an offensive username at sign up', async () => {
            const createUser = vi.fn<UserStore['createUser']>()
            const store: UserStore = Object.create(null)
            store.createUser = createUser
            const service = new UserService(
                store,
                TokenService.prototype,
                LocalTaskService.prototype
            )

            await expect(
                service.createUser({ ...user, username: 'n1gger' }, 'a long enough password')
            ).rejects.toThrow(UsernameNotAllowedError)
            expect(createUser).not.toHaveBeenCalled()
        })

        it('refuses renaming yourself to an offensive username', async () => {
            const { service } = fixture()
            await expect(service.updateUser(session, { username: 'n1gger' })).rejects.toThrow(
                UsernameNotAllowedError
            )
        })

        it('lets an existing account keep its username while changing something else', async () => {
            const { service } = fixture({ ...user, username: 'Fuckface' })
            await expect(service.updateUser(session, { username: 'fuckFACE' })).resolves.toEqual(
                expect.objectContaining({ username: 'fuckFACE' })
            )
        })
    })

    describe('reserved usernames', () => {
        it('refuses a username that would pass for a deleted player', async () => {
            const createUser = vi.fn<UserStore['createUser']>()
            const store: UserStore = Object.create(null)
            store.createUser = createUser
            const service = new UserService(
                store,
                TokenService.prototype,
                LocalTaskService.prototype
            )

            await expect(
                service.createUser(
                    { ...user, username: 'Deleted player 1' },
                    'a long enough password'
                )
            ).rejects.toThrow(UsernameNotAllowedError)
            expect(createUser).not.toHaveBeenCalled()
        })
    })

    describe('renameAccount', () => {
        function renameFixture(existing: User) {
            const notifications = vi.fn(async () => undefined)
            const updateUser = vi.fn<UserStore['updateUser']>(async ({ fields, validator }) => {
                const stored: StoredUser = {
                    ...existing,
                    createdAt: existing.createdAt,
                    updatedAt: existing.updatedAt
                }
                validator?.(stored, fields)
                const updatedUser = { ...existing, ...fields, updatedAt: new Date(5) }
                return [updatedUser, ['username', 'updatedAt'], existing]
            })
            const store: UserStore = Object.create(null)
            store.updateUser = updateUser
            const tasks = Object.create(LocalTaskService.prototype)
            tasks.sendAccountChangeNotificationEmail = notifications
            return {
                service: new UserService(store, TokenService.prototype, tasks),
                notifications
            }
        }

        it('applies an administrator choice past the word filter and tells the account', async () => {
            const { service, notifications } = renameFixture({
                ...user,
                username: 'Old',
                email: 'a@example.test'
            })

            const renamed = await service.renameAccount('a', 'Fuckface')

            expect(renamed.username).toBe('Fuckface')
            expect(notifications).toHaveBeenCalledExactlyOnceWith({
                email: 'a@example.test',
                changeType: AccountChangeType.Username,
                timestamp: new Date(5),
                username: 'Fuckface'
            })
        })

        it('refuses a deleted account', async () => {
            const { service } = renameFixture({ ...user, status: UserStatus.Deleted })
            await expect(service.renameAccount('a', 'New')).rejects.toThrow(AccountModerationError)
        })
    })

    describe('banAccount', () => {
        it('refuses your own account before touching the store', async () => {
            const { service, updateUser } = fixture()
            await expect(service.banAccount('a', 'a')).rejects.toThrow(AccountModerationError)
            expect(updateUser).not.toHaveBeenCalled()
        })

        it('refuses an administrator', async () => {
            const { service } = fixture({ ...user, roles: [Role.User, Role.Admin] })
            await expect(service.banAccount('a', 'other')).rejects.toThrow(AccountModerationError)
        })

        it('refuses a deleted account', async () => {
            const { service } = fixture({ ...user, status: UserStatus.Deleted })
            await expect(service.banAccount('a', 'other')).rejects.toThrow(AccountModerationError)
        })

        it('makes the account Inactive', async () => {
            const { service, updateUser } = fixture()
            await expect(service.banAccount('a', 'other')).resolves.toMatchObject({
                status: UserStatus.Inactive
            })
            expect(updateUser).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ fields: { status: UserStatus.Inactive } })
            )
        })
    })

    describe('deleting an account', () => {
        function deletionFixture(existing: User) {
            const tombstone: User = {
                id: existing.id,
                status: UserStatus.Deleted,
                roles: [],
                externalIds: []
            }
            const deleteUser = vi.fn<UserStore['deleteUser']>(async (_userId, validate) => {
                validate?.({ ...existing, createdAt: undefined, updatedAt: undefined })
                return [tombstone, existing]
            })
            const store: UserStore = Object.create(null)
            store.deleteUser = deleteUser
            return {
                service: new UserService(store, TokenService.prototype, LocalTaskService.prototype),
                deleteUser
            }
        }
        const recentSession: AuthenticatedSession = { ...session, authenticatedAt: new Date() }

        it('lets the owner delete their account after a recent sign-in', async () => {
            const { service } = deletionFixture({ ...user, username: 'Alice' })
            const [tombstone] = await service.deleteOwnAccount(recentSession)
            expect(tombstone.status).toBe(UserStatus.Deleted)
        })

        it('asks the owner to sign in again when their proof is old', async () => {
            const { service } = deletionFixture(user)
            await expect(
                service.deleteOwnAccount({ ...session, authenticatedAt: new Date(0) })
            ).rejects.toThrow(RecentAuthenticationRequiredError)
        })

        it('refuses an administrator deleting their own account from their profile', async () => {
            const { service } = deletionFixture({ ...user, roles: [Role.User, Role.Admin] })
            await expect(service.deleteOwnAccount(recentSession)).rejects.toThrow(
                AccountModerationError
            )
        })

        it('refuses an administrator deleting their own account from the admin tools', async () => {
            const { service, deleteUser } = deletionFixture(user)
            await expect(service.deleteAccountAsAdministrator('a', 'a')).rejects.toThrow(
                AccountModerationError
            )
            expect(deleteUser).not.toHaveBeenCalled()
        })

        it('refuses deleting another administrator or an already deleted account', async () => {
            const admin = deletionFixture({ ...user, roles: [Role.User, Role.Admin] })
            await expect(admin.service.deleteAccountAsAdministrator('a', 'other')).rejects.toThrow(
                AccountModerationError
            )
            const deleted = deletionFixture({ ...user, status: UserStatus.Deleted })
            await expect(
                deleted.service.deleteAccountAsAdministrator('a', 'other')
            ).rejects.toThrow(AccountModerationError)
        })

        it('lets an administrator delete another account', async () => {
            const { service } = deletionFixture(user)
            await expect(service.deleteAccountAsAdministrator('a', 'other')).resolves.toEqual([
                expect.objectContaining({ status: UserStatus.Deleted }),
                user
            ])
        })
    })

    describe('unbanAccount', () => {
        it('leaves an account that is not banned untouched', async () => {
            const deleted = { ...user, status: UserStatus.Deleted }
            const { service } = fixture(deleted)
            await expect(service.unbanAccount('a')).resolves.toEqual(deleted)
        })
    })

    describe('username search', () => {
        function searchFixture() {
            const store: UserStore = Object.create(null)
            store.findActiveUsernames = vi.fn(async () => ['alice', 'alina'])
            store.findAllUsernames = vi.fn(async () => ['alice', 'alina', 'alibanned'])
            store.findByUsername = vi.fn(async (username: string) => ({ ...user, username }))
            store.updateUser = vi.fn<UserStore['updateUser']>(async ({ fields }) => {
                const updated = { ...user, username: 'alina', ...fields }
                return [updated, Object.keys(fields), { ...user, username: 'alina' }]
            })
            return {
                store,
                service: new UserService(store, TokenService.prototype, LocalTaskService.prototype)
            }
        }

        // The first search loads the list, and that load would overwrite anything added before it.
        async function loadListedUsernames(service: UserService) {
            await service.searchUsernames('any')
        }

        it('offers players only Active accounts', async () => {
            const { service } = searchFixture()
            expect(await service.searchUsernames('ali')).toEqual(
                expect.not.arrayContaining(['alibanned'])
            )
        })

        it('lets an administrator find a banned account', async () => {
            const { service } = searchFixture()
            const found = await service.searchUsers('alib')
            expect(found.map((account) => account.username)).toEqual(['alibanned'])
        })

        it('drops a banned account from the players search at once', async () => {
            const { service } = searchFixture()
            expect(await service.searchUsernames('alina')).toEqual(['alina'])
            await service.banAccount('a', 'other')
            expect(await service.searchUsernames('alina')).toEqual([])
        })

        it('does not offer a new account until it is Active', async () => {
            const { service, store } = searchFixture()
            await loadListedUsernames(service)
            store.createUser = vi.fn(async (created: User) => created)

            await service.createUser(
                { ...user, status: UserStatus.Incomplete, username: 'Newcomer' },
                'a long enough password'
            )

            expect(await service.searchUsernames('newcomer')).toEqual([])
        })

        it('passes a sign-up age confirmation to the store', async () => {
            const { service, store } = searchFixture()
            store.createUser = vi.fn(async (created: User) => created)

            await service.createUser(
                { ...user, status: UserStatus.Incomplete, username: 'Newcomer' },
                'a long enough password',
                { confirmAge: true }
            )

            expect(store.createUser).toHaveBeenCalledWith(expect.anything(), expect.any(String), {
                confirmAge: true
            })
        })

        it('does not offer a username an Incomplete account chooses in onboarding', async () => {
            const { service, store } = searchFixture()
            await loadListedUsernames(service)
            const incomplete = { ...user, status: UserStatus.Incomplete }
            store.updateUser = vi.fn<UserStore['updateUser']>(async ({ fields }) => [
                { ...incomplete, ...fields },
                ['username'],
                incomplete
            ])

            await service.updateUser(session, { username: 'Newcomer' })

            expect(await service.searchUsernames('newcomer')).toEqual([])
        })

        it('offers an account once verifying its email makes it Active', async () => {
            const { service, store } = searchFixture()
            await loadListedUsernames(service)
            const account = {
                ...user,
                status: UserStatus.Incomplete,
                username: 'Newcomer',
                email: 'a@example.test'
            }
            store.updateUser = vi.fn<UserStore['updateUser']>(async () => [
                { ...account, status: UserStatus.Active },
                ['emailVerified', 'status'],
                account
            ])
            const consume = vi
                .spyOn(TokenService.prototype, 'consumeChallenge')
                .mockReturnValue(async () => {})

            await service.verifyEmail(account, 'code')
            expect(await service.searchUsernames('newcomer')).toEqual(['newcomer'])

            await service.verifyEmail(account, 'code')
            expect(await service.searchUsernames('newcomer')).toEqual(['newcomer'])
            consume.mockRestore()
        })

        it('offers an account once choosing a username makes it Active', async () => {
            const { service, store } = searchFixture()
            await loadListedUsernames(service)
            const account = {
                ...user,
                status: UserStatus.Incomplete,
                email: 'a@example.test',
                emailVerified: true
            }
            store.updateUser = vi.fn<UserStore['updateUser']>(async () => [
                { ...account, status: UserStatus.Active, username: 'Newcomer' },
                ['username', 'status'],
                account
            ])

            await service.updateUser(session, { username: 'Newcomer' })

            expect(await service.searchUsernames('newcomer')).toEqual(['newcomer'])
        })

        it('offers an account once confirming its age makes it Active', async () => {
            const { service, store } = searchFixture()
            await loadListedUsernames(service)
            const account = {
                ...user,
                status: UserStatus.Incomplete,
                username: 'Newcomer',
                email: 'a@example.test',
                emailVerified: true
            }
            store.updateUser = vi.fn<UserStore['updateUser']>(async () => [
                { ...account, status: UserStatus.Active, ageConfirmedAt: new Date() },
                ['ageConfirmedAt', 'status'],
                account
            ])

            await service.updateUser(session, {}, undefined, { confirmAge: true })

            expect(store.updateUser).toHaveBeenCalledWith(
                expect.objectContaining({ confirmAge: true })
            )
            expect(await service.searchUsernames('newcomer')).toEqual(['newcomer'])
        })

        it('offers an Active account under its new name after it renames itself', async () => {
            const { service } = searchFixture()
            await loadListedUsernames(service)

            await service.updateUser(session, { username: 'Zelda' })

            expect(await service.searchUsernames('zelda')).toEqual(['zelda'])
            expect(await service.searchUsernames('alina')).toEqual([])
        })

        it("reloads the players list once it is old, picking up another instance's changes", async () => {
            const { service, store } = searchFixture()
            const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
            await service.searchUsernames('ali')
            now.mockReturnValue(1_000 + 5 * 60 * 1000 + 1)
            await service.searchUsernames('ali')
            expect(store.findActiveUsernames).toHaveBeenCalledTimes(2)
            now.mockRestore()
        })
    })
})
