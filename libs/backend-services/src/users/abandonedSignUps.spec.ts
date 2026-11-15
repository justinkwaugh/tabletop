import { describe, expect, it, vi } from 'vitest'
import { Role, UserStatus } from '@tabletop/common'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import type { NotificationSubscription } from '../notifications/subscriptions/notificationSubscription.js'
import type { AbandonedSignUpDeletion } from '../persistence/stores/userStore.js'
import type { StoredUser } from '../persistence/model/storedUser.js'
import { AbandonedSignUps } from './abandonedSignUps.js'

const now = new Date('2026-11-12T12:00:00Z')
const fourDaysAgo = new Date('2026-11-08T12:00:00Z')
const yesterday = new Date('2026-11-11T12:00:00Z')

const account = (id: string, fields: Partial<StoredUser> = {}): StoredUser => ({
    id,
    status: UserStatus.Incomplete,
    roles: [Role.User],
    externalIds: [],
    createdAt: fourDaysAgo,
    updatedAt: fourDaysAgo,
    ...fields
})

function fixture({
    incomplete = [account('old')],
    seated = false,
    outcome = 'deleted'
}: { incomplete?: StoredUser[]; seated?: boolean; outcome?: AbandonedSignUpDeletion } = {}) {
    let decided: boolean | undefined
    const users = {
        findIncompleteUsers: vi.fn(async () => incomplete),
        deleteAbandonedSignUp: vi.fn(
            async (userId: string, isAbandoned: (existing: StoredUser) => boolean) => {
                const existing = incomplete.find((user) => user.id === userId)
                decided = existing ? isAbandoned(existing) : undefined
                return outcome
            }
        )
    }
    const games = { hasGamesForUser: vi.fn(async () => seated) }
    const tasks = { createPushTask: vi.fn(async () => undefined) }
    const deletion = {
        sessions: { revokeAll: vi.fn(async () => undefined) },
        tokens: { cancelAllChallenges: vi.fn(async () => undefined) },
        preferences: { deletePreferences: vi.fn(async () => undefined) },
        subscriptions: {
            findNotificationSubscriptions: vi.fn(async (): Promise<NotificationSubscription[]> => [
                { id: 'push-1', transport: TransportType.Discord, discordUserId: 'd-1' }
            ]),
            deleteNotificationSubscription: vi.fn(async () => undefined)
        }
    }
    const signUps = new AbandonedSignUps(users, games, tasks, deletion, () => now)
    return { signUps, users, games, tasks, deletion, decided: () => decided }
}

describe('AbandonedSignUps', () => {
    it('queues only Incomplete Accounts never activated and three days old', async () => {
        const { signUps, tasks } = fixture({
            incomplete: [
                account('old'),
                account('recent', { createdAt: yesterday }),
                account('once-active', { activatedAt: fourDaysAgo })
            ]
        })

        await expect(signUps.sweep()).resolves.toEqual({ queuedUserIds: ['old'] })
        expect(tasks.createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'maintenance',
            path: '/users/deleteAbandonedSignUp',
            payload: { userId: 'old' },
            uniqueName: 'abandoned-sign-up-old-2026-11-12'
        })
    })

    it('deletes the record, then releases sessions, codes, preferences and subscriptions', async () => {
        const { signUps, users, deletion, decided } = fixture()

        await signUps.deleteIfAbandoned({ userId: 'old' })

        expect(users.deleteAbandonedSignUp).toHaveBeenCalledOnce()
        expect(decided()).toBe(true)
        expect(deletion.sessions.revokeAll).toHaveBeenCalledWith('old')
        expect(deletion.tokens.cancelAllChallenges).toHaveBeenCalledWith('old')
        expect(deletion.preferences.deletePreferences).toHaveBeenCalledWith('old')
        expect(deletion.subscriptions.deleteNotificationSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'push-1' })
        )
    })

    it('finishes the clean-up when a retry finds the record already gone', async () => {
        const { signUps, deletion } = fixture({ outcome: 'missing' })

        await signUps.deleteIfAbandoned({ userId: 'old' })

        expect(deletion.sessions.revokeAll).toHaveBeenCalledWith('old')
    })

    it('leaves an Account that finished signing up before the task ran', async () => {
        const { signUps, deletion } = fixture({ outcome: 'kept' })

        await signUps.deleteIfAbandoned({ userId: 'old' })

        expect(deletion.sessions.revokeAll).not.toHaveBeenCalled()
        expect(deletion.preferences.deletePreferences).not.toHaveBeenCalled()
    })

    it('rechecks the rule on the record read inside the transaction', async () => {
        const { signUps, decided } = fixture({
            incomplete: [account('old', { status: UserStatus.Active })],
            outcome: 'kept'
        })

        await signUps.deleteIfAbandoned({ userId: 'old' })

        expect(decided()).toBe(false)
    })

    it('never deletes an Account seated in a game', async () => {
        const { signUps, users, deletion } = fixture({ seated: true })

        await signUps.deleteIfAbandoned({ userId: 'old' })

        expect(users.deleteAbandonedSignUp).not.toHaveBeenCalled()
        expect(deletion.sessions.revokeAll).not.toHaveBeenCalled()
    })
})
