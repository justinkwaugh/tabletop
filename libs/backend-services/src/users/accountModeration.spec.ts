import { describe, expect, it, vi } from 'vitest'
import { AccountChangeType, Role, UserStatus, type User } from '@tabletop/common'
import type { AuthenticatedSession } from '../sessions/authenticatedSession.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import type { NotificationSubscription } from '../notifications/subscriptions/notificationSubscription.js'
import { AccountModeration } from './accountModeration.js'
import { AccountModerationError } from './errors.js'

const account = (status: UserStatus, username = 'Bob'): User => ({
    id: 'bob',
    status,
    username,
    roles: [Role.User],
    externalIds: []
})

const tombstone: User = { id: 'bob', status: UserStatus.Deleted, roles: [], externalIds: [] }
const withEmail: User = { ...account(UserStatus.Active), email: 'bob@example.test' }

function fixture(stored: User = account(UserStatus.Active)) {
    const users = {
        getUser: vi.fn(async () => stored),
        renameAccount: vi.fn(async (_userId: string, username: string) => ({
            ...stored,
            username
        })),
        banAccount: vi.fn(async () => ({ ...stored, status: UserStatus.Inactive })),
        unbanAccount: vi.fn(async () => ({ ...stored, status: UserStatus.Active })),
        deleteOwnAccount: vi.fn(async (): Promise<[User, User]> => [tombstone, withEmail]),
        deleteAccountAsAdministrator: vi.fn(async (): Promise<[User, User]> => [
            tombstone,
            withEmail
        ])
    }
    const games = {
        renamePlayerInGames: vi.fn(async () => undefined),
        releaseBannedPlayer: vi.fn(async () => undefined),
        anonymizePlayerInGames: vi.fn(async () => undefined)
    }
    const tasks = {
        createPushTask: vi.fn(async () => undefined),
        sendAccountChangeNotificationEmail: vi.fn(async () => undefined)
    }
    const deletion = {
        sessions: { revokeAll: vi.fn(async () => undefined) },
        tokens: { cancelAllChallenges: vi.fn(async () => undefined) },
        preferences: { deletePreferences: vi.fn(async () => undefined) },
        subscriptions: {
            findNotificationSubscriptions: vi.fn(async (): Promise<NotificationSubscription[]> => [
                { id: 'discord-1', transport: TransportType.Discord, discordUserId: 'd-1' }
            ]),
            deleteNotificationSubscription: vi.fn(async () => undefined)
        }
    }
    const relay = {
        publishMessage: vi.fn(async (_published: { topic: string; message: string }) => undefined)
    }
    const supportsCalls = vi.fn(async () => true)
    const moderation = new AccountModeration(
        users,
        games,
        tasks,
        relay,
        supportsCalls,
        deletion,
        () => new Date('2026-11-04T00:00:10Z')
    )
    return { moderation, users, games, tasks, relay, supportsCalls, deletion }
}

describe('AccountModeration', () => {
    it('renames the account and queues the rewrite of its games', async () => {
        const { moderation, users, tasks } = fixture()

        const renamed = await moderation.rename('bob', '  Robert  ')

        expect(renamed.username).toBe('Robert')
        expect(users.renameAccount).toHaveBeenCalledExactlyOnceWith('bob', 'Robert')
        expect(tasks.createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'maintenance',
            path: '/users/syncPlayerNames',
            payload: { userId: 'bob' }
        })
    })

    it('refuses an empty username before touching the account', async () => {
        const { moderation, users, tasks } = fixture()

        await expect(moderation.rename('bob', '   ')).rejects.toThrow(AccountModerationError)
        expect(users.renameAccount).not.toHaveBeenCalled()
        expect(tasks.createPushTask).not.toHaveBeenCalled()
    })

    it('bans the account, closes its realtime connections and queues releasing its games', async () => {
        const { moderation, users, tasks, relay } = fixture()

        const banned = await moderation.ban('bob', 'admin')

        expect(banned.status).toBe(UserStatus.Inactive)
        expect(users.banAccount).toHaveBeenCalledExactlyOnceWith('bob', 'admin')
        const message = relay.publishMessage.mock.lastCall?.at(0)
        expect(message).toEqual({
            topic: 'realtime-control',
            message: expect.any(String)
        })
        expect(JSON.parse(String(message?.message))).toEqual({
            revoke: 'bob',
            at: new Date('2026-11-04T00:00:10Z').getTime() / 1000
        })
        expect(tasks.createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'maintenance',
            path: '/users/releaseBannedPlayer',
            payload: { userId: 'bob' }
        })
    })

    it('still bans and queues when the relay message cannot be sent', async () => {
        const { moderation, tasks, relay } = fixture()
        const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        relay.publishMessage.mockRejectedValueOnce(new Error('redis down'))

        await expect(moderation.ban('bob', 'admin')).resolves.toMatchObject({
            status: UserStatus.Inactive
        })
        expect(tasks.createPushTask).toHaveBeenCalledOnce()
        logged.mockRestore()
    })

    it('queues nothing when the ban itself is refused', async () => {
        const { moderation, users, tasks, relay } = fixture()
        users.banAccount.mockRejectedValueOnce(new AccountModerationError('no'))

        await expect(moderation.ban('bob', 'admin')).rejects.toThrow(AccountModerationError)
        expect(relay.publishMessage).not.toHaveBeenCalled()
        expect(tasks.createPushTask).not.toHaveBeenCalled()
    })

    it('rewrites games with the name the account holds when the task runs', async () => {
        const stored = account(UserStatus.Active, 'Latest')
        const { moderation, games } = fixture(stored)

        await moderation.syncPlayerNames({ userId: 'bob' })

        expect(games.renamePlayerInGames).toHaveBeenCalledExactlyOnceWith(stored)
    })

    it('releases games only while the account is still banned', async () => {
        const banned = fixture(account(UserStatus.Inactive))
        await banned.moderation.releaseBannedPlayer({ userId: 'bob' })
        expect(banned.games.releaseBannedPlayer).toHaveBeenCalledExactlyOnceWith({
            user: account(UserStatus.Inactive),
            supportsCalls: banned.supportsCalls
        })

        const liftedMeanwhile = fixture(account(UserStatus.Active))
        await liftedMeanwhile.moderation.releaseBannedPlayer({ userId: 'bob' })
        expect(liftedMeanwhile.games.releaseBannedPlayer).not.toHaveBeenCalled()
    })

    describe('deleting an account', () => {
        const session: AuthenticatedSession = {
            id: 'session-1',
            userId: 'bob',
            generation: 0,
            createdAt: new Date('2026-11-04T00:00:00Z'),
            expiresAt: new Date('2027-05-03T00:00:00Z')
        }

        it('closes realtime connections, queues the clean-up and confirms by email', async () => {
            const { moderation, users, tasks, relay } = fixture()

            const deleted = await moderation.deleteOwnAccount(session)

            expect(deleted.status).toBe(UserStatus.Deleted)
            expect(users.deleteOwnAccount).toHaveBeenCalledWith(session)
            expect(relay.publishMessage).toHaveBeenCalledOnce()
            expect(tasks.createPushTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: '/users/releaseDeletedAccount',
                    payload: { userId: 'bob' }
                })
            )
            expect(tasks.sendAccountChangeNotificationEmail).toHaveBeenCalledWith({
                email: 'bob@example.test',
                changeType: AccountChangeType.AccountDeleted,
                timestamp: new Date('2026-11-04T00:00:10Z')
            })
        })

        it('still succeeds when the confirmation email cannot be queued', async () => {
            const { moderation, users, tasks } = fixture()
            tasks.sendAccountChangeNotificationEmail.mockRejectedValueOnce(new Error('queue down'))
            vi.spyOn(console, 'error').mockImplementation(() => {})

            await expect(moderation.deleteAccount('bob', 'admin')).resolves.toMatchObject({
                status: UserStatus.Deleted
            })
            expect(users.deleteAccountAsAdministrator).toHaveBeenCalledWith('bob', 'admin')
        })

        it('clears sessions, codes, notifications and games once the account is deleted', async () => {
            const { moderation, games, deletion } = fixture(tombstone)

            await moderation.releaseDeletedAccount({ userId: 'bob' })

            expect(deletion.sessions.revokeAll).toHaveBeenCalledWith('bob')
            expect(deletion.tokens.cancelAllChallenges).toHaveBeenCalledWith('bob')
            expect(deletion.preferences.deletePreferences).toHaveBeenCalledWith('bob')
            expect(deletion.subscriptions.findNotificationSubscriptions).toHaveBeenCalledWith(
                'user-bob'
            )
            expect(deletion.subscriptions.deleteNotificationSubscription).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'discord-1', transport: TransportType.Discord })
            )
            expect(games.releaseBannedPlayer).toHaveBeenCalledWith(
                expect.objectContaining({ user: tombstone })
            )
            expect(games.anonymizePlayerInGames).toHaveBeenCalledWith(tombstone)
        })

        it('reruns the clean-up when an administrator deletes an account already deleted', async () => {
            const { moderation, users, tasks } = fixture(tombstone)

            await expect(moderation.deleteAccount('bob', 'admin')).resolves.toEqual(tombstone)

            expect(users.deleteAccountAsAdministrator).not.toHaveBeenCalled()
            expect(tasks.createPushTask).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/users/releaseDeletedAccount' })
            )
            expect(tasks.sendAccountChangeNotificationEmail).not.toHaveBeenCalled()
        })

        it('still reports the deletion when its clean-up cannot be queued', async () => {
            const { moderation, tasks } = fixture()
            tasks.createPushTask.mockRejectedValueOnce(new Error('queue down'))
            vi.spyOn(console, 'error').mockImplementation(() => {})

            await expect(moderation.deleteAccount('bob', 'admin')).resolves.toMatchObject({
                status: UserStatus.Deleted
            })
            expect(tasks.sendAccountChangeNotificationEmail).toHaveBeenCalledOnce()
        })

        it('renames the account in its games even when releasing a game fails', async () => {
            const { moderation, games } = fixture(tombstone)
            games.releaseBannedPlayer.mockRejectedValueOnce(new Error('title unavailable'))

            await expect(moderation.releaseDeletedAccount({ userId: 'bob' })).rejects.toThrow(
                AggregateError
            )
            expect(games.anonymizePlayerInGames).toHaveBeenCalledWith(tombstone)
        })

        it('does nothing in the clean-up task for an account that is not deleted', async () => {
            const { moderation, games, deletion } = fixture()

            await moderation.releaseDeletedAccount({ userId: 'bob' })

            expect(deletion.sessions.revokeAll).not.toHaveBeenCalled()
            expect(games.anonymizePlayerInGames).not.toHaveBeenCalled()
        })
    })
})
