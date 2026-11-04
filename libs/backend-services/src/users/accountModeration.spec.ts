import { describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { AccountModeration } from './accountModeration.js'
import { AccountModerationError } from './errors.js'

const account = (status: UserStatus, username = 'Bob'): User => ({
    id: 'bob',
    status,
    username,
    roles: [Role.User],
    externalIds: []
})

function fixture(stored: User = account(UserStatus.Active)) {
    const users = {
        getUser: vi.fn(async () => stored),
        renameAccount: vi.fn(async (_userId: string, username: string) => ({
            ...stored,
            username
        })),
        banAccount: vi.fn(async () => ({ ...stored, status: UserStatus.Inactive })),
        unbanAccount: vi.fn(async () => ({ ...stored, status: UserStatus.Active }))
    }
    const games = {
        renamePlayerInGames: vi.fn(async () => undefined),
        releaseBannedPlayer: vi.fn(async () => undefined)
    }
    const tasks = { createPushTask: vi.fn(async () => undefined) }
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
        () => new Date('2026-11-04T00:00:10Z')
    )
    return { moderation, users, games, tasks, relay, supportsCalls }
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
})
