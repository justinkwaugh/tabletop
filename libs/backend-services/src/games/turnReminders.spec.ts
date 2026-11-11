import { describe, expect, it, vi } from 'vitest'
import * as Value from 'typebox/value'
import {
    DEFERRED_TURN_REMINDER_INDEX,
    enqueueTurnReminder,
    FIRST_TURN_REMINDER_INDEX,
    nextTurnReminderIndex,
    TURN_REMINDER_DELAYS,
    turnReminderDelaySeconds,
    turnReminderIndex,
    TurnReminderTask
} from './turnReminders.js'
import type { TaskService } from '../tasks/taskService.js'
import { weekReminderHours, type User } from '@tabletop/common'

const HOUR = 60 * 60

function reminderTimes(): number[] {
    const times: number[] = []
    let elapsed = 0
    let reminderIndex: number | undefined = FIRST_TURN_REMINDER_INDEX
    while (reminderIndex !== undefined) {
        elapsed += TURN_REMINDER_DELAYS[reminderIndex]
        times.push(elapsed)
        reminderIndex = nextTurnReminderIndex(reminderIndex)
    }
    return times
}

function task(fields: Pick<TurnReminderTask, 'reminderIndex' | 'delay'>): TurnReminderTask {
    return { userId: 'user', gameId: 'game', notificationId: 'notification', ...fields }
}

describe('turn reminders', () => {
    it('reminds after a minute, then one, four and eight hours apart, then twice a day for a week', () => {
        const firstRepeat = 60 + 13 * HOUR + 12 * HOUR
        expect(reminderTimes()).toEqual([
            60,
            60 + HOUR,
            60 + 5 * HOUR,
            60 + 13 * HOUR,
            ...Array.from({ length: 14 }, (_, repeat) => firstRepeat + repeat * 12 * HOUR)
        ])
    })

    it('starts a deferred chain four hours out', () => {
        expect(TURN_REMINDER_DELAYS[DEFERRED_TURN_REMINDER_INDEX]).toBe(4 * HOUR)
    })

    it('queues the reminder when it is due with its scheduled delay alongside its index', async () => {
        const createPushTask = vi.fn<TaskService['createPushTask']>(async () => {})
        await enqueueTurnReminder(
            { createPushTask },
            { userId: 'user', gameId: 'game', notificationId: 'notification', reminderIndex: 3 },
            10 * HOUR
        )
        expect(createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'turn-notification',
            path: '/notification/sendTurnNotification',
            inSeconds: 10 * HOUR,
            payload: {
                userId: 'user',
                gameId: 'game',
                notificationId: 'notification',
                reminderIndex: 3,
                delay: 8 * HOUR
            }
        })
    })

    it('accepts tasks queued before reminders were numbered', () => {
        expect(Value.Check(TurnReminderTask, task({ delay: 4 * HOUR }))).toBe(true)
    })

    it('continues tasks queued before reminders were numbered from the delay they waited', () => {
        expect(turnReminderIndex(task({}))).toBe(0)
        expect(turnReminderIndex(task({ delay: 60 }))).toBe(0)
        expect(turnReminderIndex(task({ delay: 4 * HOUR }))).toBe(2)
        expect(turnReminderIndex(task({ delay: 12 * HOUR }))).toBe(4)
    })

    it('rejects an unnumbered task whose delay is not in the schedule', () => {
        expect(() => turnReminderIndex(task({ delay: 2 * HOUR }))).toThrow(
            'Turn reminder delay 7200 is not in the reminder schedule'
        )
    })

    it('prefers the reminder index over the delay', () => {
        expect(turnReminderIndex(task({ reminderIndex: 5, delay: 12 * HOUR }))).toBe(5)
    })
})

describe('turn reminders in reminder hours', () => {
    const reminderHours = weekReminderHours([18, 19, 20, 21])
    const recipient: Pick<User, 'timeZone' | 'preferences'> = {
        timeZone: 'America/Chicago',
        preferences: {
            preventWebNotificationPrompt: false,
            preferredColorsEnabled: false,
            preferredColors: [],
            reminderHours
        }
    }
    const fridayMorning = new Date('2026-10-16T12:00:00.000Z')
    const fridayEvening = new Date('2026-10-16T23:00:00.000Z')
    const secondsUntil = (time: Date) => (time.getTime() - fridayMorning.getTime()) / 1000

    it('sends the first two reminders at their usual delay', () => {
        expect(turnReminderDelaySeconds(0, fridayMorning, recipient)).toBe(60)
        expect(turnReminderDelaySeconds(1, fridayMorning, recipient)).toBe(HOUR)
    })

    it('waits for a reminder hour from the four hour reminder on', () => {
        expect(
            turnReminderDelaySeconds(DEFERRED_TURN_REMINDER_INDEX, fridayMorning, recipient)
        ).toBe(secondsUntil(fridayEvening))
        expect(turnReminderDelaySeconds(3, fridayMorning, recipient)).toBe(
            secondsUntil(fridayEvening)
        )
        expect(turnReminderDelaySeconds(4, fridayMorning, recipient)).toBe(12 * HOUR)
    })

    it('keeps the usual delay without reminder hours or a time zone', () => {
        expect(turnReminderDelaySeconds(4, fridayMorning, {})).toBe(12 * HOUR)
        expect(
            turnReminderDelaySeconds(4, fridayMorning, { preferences: recipient.preferences })
        ).toBe(12 * HOUR)
    })
})
