import { describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import {
    TIME_DIFFERENCE_NOTICE_SPREAD_SECONDS,
    TimeDifferenceNotice
} from './timeDifferenceNotice.js'
import type { NoticeStore } from '../persistence/stores/noticeStore.js'
import type { CreatePushTaskOptions } from '../tasks/taskService.js'

const now = new Date('2026-11-19T12:00:00Z')
const startsAt = new Date('2026-11-26T12:00:00Z')

function account(id: string, fields: Partial<User> = {}): User {
    return {
        id,
        username: id,
        email: `${id}@example.com`,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: [],
        ...fields
    }
}

function fixture(accounts: User[], config: { startsAt: Date | undefined } = { startsAt }) {
    let queuedAt: Date | undefined
    const notices: NoticeStore = {
        findQueuedAt: vi.fn(async () => queuedAt),
        recordQueued: vi.fn(async (_id: string, at: Date) => {
            queuedAt = at
        })
    }
    const users = {
        findActiveUserIds: vi.fn(async () => accounts.map(({ id }) => id)),
        findById: vi.fn(async (id: string) => accounts.find((candidate) => candidate.id === id))
    }
    const tasks = { createPushTask: vi.fn(async (_options: CreatePushTaskOptions<unknown>) => {}) }
    const email = { sendTimeDifferenceNoticeEmail: vi.fn(async () => {}) }
    const notice = new TimeDifferenceNotice(
        users,
        notices,
        tasks,
        email,
        { ...config, frontendHost: 'https://example.com' },
        () => now
    )
    return { notice, tasks, email }
}

describe('TimeDifferenceNotice', () => {
    it('queues one named task per active account, spread over the sending window', async () => {
        const accounts = ['a', 'b', 'c', 'd'].map((id) => account(id))
        const { notice, tasks } = fixture(accounts)
        expect(await notice.queue()).toEqual({ outcome: 'queued', queued: 4, startsAt })
        const queued = tasks.createPushTask.mock.calls.map(([options]) => options)
        expect(queued.map((options) => options.uniqueName)).toEqual([
            'time-difference-notice-a',
            'time-difference-notice-b',
            'time-difference-notice-c',
            'time-difference-notice-d'
        ])
        expect(queued.map((options) => options.inSeconds)).toEqual([
            0,
            TIME_DIFFERENCE_NOTICE_SPREAD_SECONDS / 4,
            TIME_DIFFERENCE_NOTICE_SPREAD_SECONDS / 2,
            (TIME_DIFFERENCE_NOTICE_SPREAD_SECONDS * 3) / 4
        ])
        expect(queued.every((options) => options.queue === 'maintenance')).toBe(true)
    })

    it('refuses to queue a second time', async () => {
        const { notice, tasks } = fixture([account('a')])
        await notice.queue()
        expect(await notice.queue()).toEqual({ outcome: 'alreadyQueued', queuedAt: now })
        expect(tasks.createPushTask).toHaveBeenCalledOnce()
    })

    it('needs a configured start date that has not passed', async () => {
        await expect(fixture([], { startsAt: undefined }).notice.queue()).rejects.toThrow(
            'No time difference'
        )
        await expect(
            fixture([], { startsAt: new Date('2026-11-01') }).notice.queue()
        ).rejects.toThrow('before the start date')
    })

    it('emails an active account with links to Preferences and the policy', async () => {
        const { notice, email } = fixture([account('dana')])
        await notice.send({ userId: 'dana' })
        expect(email.sendTimeDifferenceNoticeEmail).toHaveBeenCalledWith({
            to: { email: 'dana@example.com', locale: 'en' },
            username: 'dana',
            startsAt,
            preferencesUrl: 'https://example.com/?preferences',
            privacyUrl: 'https://example.com/privacy'
        })
    })

    it('skips an account that is no longer active', async () => {
        const { notice, email } = fixture([account('gone', { status: UserStatus.Deleted })])
        await notice.send({ userId: 'gone' })
        await notice.send({ userId: 'missing' })
        expect(email.sendTimeDifferenceNoticeEmail).not.toHaveBeenCalled()
    })
})
