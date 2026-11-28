import {
    assert,
    UserStatus,
    type TimeDifferenceNoticeQueueing,
    type TimeDifferenceNoticeStatus
} from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { UserStore } from '../persistence/stores/userStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { emailRecipient, type EmailService } from '../email/emailService.js'
import type { NoticeStore } from '../persistence/stores/noticeStore.js'

export const TimeDifferenceNoticeTask = Type.Object(
    { userId: Type.String() },
    { additionalProperties: false }
)
export type TimeDifferenceNoticeTask = Static<typeof TimeDifferenceNoticeTask>

export const TIME_DIFFERENCE_NOTICE_SPREAD_SECONDS = 2 * 60 * 60
export const TIME_DIFFERENCE_NOTICE_ID = 'time-difference'
const QUEUEING_CONCURRENCY = 20

// Legally required before any time difference is shown; named tasks keep a retry from emailing twice.
export class TimeDifferenceNotice {
    constructor(
        private readonly users: Pick<UserStore, 'findActiveUserIds' | 'findById'>,
        private readonly notices: NoticeStore,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly email: Pick<EmailService, 'sendTimeDifferenceNoticeEmail'>,
        private readonly config: { startsAt: Date | undefined; frontendHost: string },
        private readonly now: () => Date = () => new Date()
    ) {}

    async status(): Promise<TimeDifferenceNoticeStatus> {
        const queuedAt = await this.notices.findQueuedAt(TIME_DIFFERENCE_NOTICE_ID)
        return {
            ...(this.config.startsAt ? { startsAt: this.config.startsAt } : {}),
            ...(queuedAt ? { queuedAt } : {})
        }
    }

    async queue(): Promise<TimeDifferenceNoticeQueueing> {
        const { startsAt } = this.config
        assert(startsAt !== undefined, 'No time difference start date is configured')
        const now = this.now()
        assert(startsAt > now, 'The notice must go out before the start date')
        const queuedAt = await this.notices.findQueuedAt(TIME_DIFFERENCE_NOTICE_ID)
        if (queuedAt) return { outcome: 'alreadyQueued', queuedAt }
        const userIds = await this.users.findActiveUserIds()
        for (let first = 0; first < userIds.length; first += QUEUEING_CONCURRENCY) {
            await Promise.all(
                userIds
                    .slice(first, first + QUEUEING_CONCURRENCY)
                    .map((userId, offset) =>
                        this.queueFor(userId, this.delaySeconds(first + offset, userIds.length))
                    )
            )
        }
        await this.notices.recordQueued(TIME_DIFFERENCE_NOTICE_ID, now, userIds.length)
        console.log(
            JSON.stringify({ event: 'time_difference_notice_queued', queued: userIds.length })
        )
        return { outcome: 'queued', queued: userIds.length, startsAt }
    }

    async send({ userId }: TimeDifferenceNoticeTask): Promise<void> {
        const { startsAt, frontendHost } = this.config
        assert(startsAt !== undefined, 'No time difference start date is configured')
        const user = await this.users.findById(userId)
        if (user?.status !== UserStatus.Active || !user.email || !user.username) {
            console.log(JSON.stringify({ event: 'time_difference_notice_skipped', userId }))
            return
        }
        await this.email.sendTimeDifferenceNoticeEmail({
            to: emailRecipient(user.email, user),
            username: user.username,
            startsAt,
            preferencesUrl: `${frontendHost}/?preferences`,
            privacyUrl: `${frontendHost}/privacy`
        })
        console.log(JSON.stringify({ event: 'time_difference_notice_sent', userId }))
    }

    private delaySeconds(index: number, count: number): number {
        return Math.floor((index * TIME_DIFFERENCE_NOTICE_SPREAD_SECONDS) / count)
    }

    private async queueFor(userId: string, inSeconds: number): Promise<void> {
        await this.tasks.createPushTask({
            queue: 'maintenance',
            path: '/users/sendTimeDifferenceNotice',
            payload: { userId } satisfies TimeDifferenceNoticeTask,
            inSeconds,
            uniqueName: `time-difference-notice-${userId}`
        })
    }
}
