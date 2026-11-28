import {
    sharesTimeDifference,
    timeDifferenceUserIds,
    wholeHourOffset,
    type Game,
    type TimeOffsets,
    type User
} from '@tabletop/common'
import type { UserService } from './userService.js'
import type { NoticeStore } from '../persistence/stores/noticeStore.js'
import { TIME_DIFFERENCE_NOTICE_ID } from './timeDifferenceNotice.js'

const NOTICE_RECHECK_MILLISECONDS = 5 * 60 * 1000

// Worked out when games are read, never stored with them, so turning sharing off applies at once.
export class TimeDifferences {
    private noticeSent = false
    private noticeCheckedAt: number | undefined
    private noticeCheck: Promise<boolean> | undefined

    constructor(
        private readonly users: Pick<UserService, 'getUsers'>,
        private readonly notices: Pick<NoticeStore, 'findQueuedAt'>,
        private readonly startsAt: Date | undefined,
        private readonly now: () => Date = () => new Date()
    ) {}

    async offsetsFor(games: readonly Game[]): Promise<TimeOffsets | undefined> {
        const now = this.now()
        if (!(await this.isShowing(now))) return undefined
        const userIds = timeDifferenceUserIds(games)
        if (userIds.length === 0) return {}
        const users = await this.users.getUsers(userIds)
        return Object.fromEntries(
            userIds.map((userId, index) => [userId, this.sharedOffset(users[index], now) ?? null])
        )
    }

    async offsetFor(userId: string): Promise<number | undefined> {
        const now = this.now()
        if (!(await this.isShowing(now))) return undefined
        const [user] = await this.users.getUsers([userId])
        return this.sharedOffset(user, now)
    }

    private async isShowing(now: Date): Promise<boolean> {
        return !!this.startsAt && now >= this.startsAt && (await this.wasNoticeSent(now))
    }

    private wasNoticeSent(now: Date): Promise<boolean> {
        if (this.noticeSent) return Promise.resolve(true)
        if (this.noticeCheck) return this.noticeCheck
        const checkedAt = this.noticeCheckedAt
        if (checkedAt !== undefined && now.getTime() - checkedAt < NOTICE_RECHECK_MILLISECONDS) {
            return Promise.resolve(false)
        }
        this.noticeCheckedAt = now.getTime()
        this.noticeCheck = this.notices
            .findQueuedAt(TIME_DIFFERENCE_NOTICE_ID)
            .then((queuedAt) => (this.noticeSent = queuedAt !== undefined))
            // Offsets only decorate game lists, so a failed read must not fail the list.
            .catch((error: unknown) => {
                console.warn('Could not read whether the time difference notice was sent', error)
                return false
            })
            .finally(() => (this.noticeCheck = undefined))
        return this.noticeCheck
    }

    private sharedOffset(user: User | undefined, now: Date): number | undefined {
        if (!user?.timeZone || !sharesTimeDifference(user.preferences)) return undefined
        return wholeHourOffset(user.timeZone, now)
    }
}
