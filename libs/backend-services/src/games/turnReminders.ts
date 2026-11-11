import { assert, type User } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { TaskService } from '../tasks/taskService.js'
import { nextReminderHour } from './reminderHours.js'

const HOUR_SECONDS = 60 * 60
const DAY_SECONDS = 24 * HOUR_SECONDS
const REPEAT_SECONDS = 12 * HOUR_SECONDS
const REPEAT_DURATION_SECONDS = 7 * DAY_SECONDS

export const TURN_REMINDER_DELAYS: readonly number[] = [
    60,
    HOUR_SECONDS,
    4 * HOUR_SECONDS,
    8 * HOUR_SECONDS,
    ...Array<number>(REPEAT_DURATION_SECONDS / REPEAT_SECONDS).fill(REPEAT_SECONDS)
]

export const FIRST_TURN_REMINDER_INDEX = 0
export const DEFERRED_TURN_REMINDER_INDEX = TURN_REMINDER_DELAYS.indexOf(4 * HOUR_SECONDS)

export const TurnReminderTask = Type.Object(
    {
        userId: Type.String(),
        gameId: Type.String(),
        notificationId: Type.String(),
        reminderIndex: Type.Optional(Type.Number()),
        delay: Type.Optional(Type.Number())
    },
    { additionalProperties: false }
)
export type TurnReminderTask = Static<typeof TurnReminderTask>

type ScheduledTurnReminder = Omit<TurnReminderTask, 'reminderIndex' | 'delay'> & {
    reminderIndex: number
}

export function turnReminderIndex({ reminderIndex, delay }: TurnReminderTask): number {
    if (reminderIndex !== undefined) {
        return reminderIndex
    }
    // Tasks queued before reminders were numbered carry only the delay they waited.
    const legacyIndex = TURN_REMINDER_DELAYS.indexOf(delay ?? TURN_REMINDER_DELAYS[0])
    assert(legacyIndex >= 0, `Turn reminder delay ${delay} is not in the reminder schedule`)
    return legacyIndex
}

export function nextTurnReminderIndex(reminderIndex: number): number | undefined {
    const next = reminderIndex + 1
    return next < TURN_REMINDER_DELAYS.length ? next : undefined
}

export function turnReminderDelaySeconds(
    reminderIndex: number,
    now: Date,
    recipient: Pick<User, 'timeZone' | 'preferences'>
): number {
    const delay = TURN_REMINDER_DELAYS[reminderIndex]
    const reminderHours = recipient.preferences?.reminderHours
    if (reminderIndex < DEFERRED_TURN_REMINDER_INDEX || !reminderHours || !recipient.timeZone) {
        return delay
    }
    const due = new Date(now.getTime() + delay * 1000)
    const sendAt = nextReminderHour(due, recipient.timeZone, reminderHours)
    return Math.ceil((sendAt.getTime() - now.getTime()) / 1000)
}

export async function enqueueTurnReminder(
    tasks: Pick<TaskService, 'createPushTask'>,
    reminder: ScheduledTurnReminder,
    inSeconds: number
): Promise<void> {
    await tasks.createPushTask({
        queue: 'turn-notification',
        path: '/notification/sendTurnNotification',
        inSeconds,
        // Revisions from before reminderIndex strip it as an unknown field and schedule from delay.
        payload: { ...reminder, delay: TURN_REMINDER_DELAYS[reminder.reminderIndex] }
    })
}
