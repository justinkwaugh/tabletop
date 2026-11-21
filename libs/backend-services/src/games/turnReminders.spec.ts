import { describe, expect, it, vi } from 'vitest'
import * as Value from 'typebox/value'
import {
    DEFERRED_TURN_REMINDER_INDEX,
    enqueueTurnReminder,
    FIRST_TURN_REMINDER_INDEX,
    planTurnReminder,
    TURN_REMINDER_DELAYS,
    turnReminderIndex,
    TurnReminderTask,
    type TurnReminderRecipient
} from './turnReminders.js'
import { reminderPreferences } from './tests/turnReminderPreferences.js'
import type { TaskService } from '../tasks/taskService.js'
import {
    DEFAULT_TURN_REMINDER_CHOICES,
    weekReminderHours,
    type TurnReminderChoices
} from '@tabletop/common'

const HOUR = 60 * 60

function choosing(turnReminders: TurnReminderChoices): TurnReminderRecipient {
    return { preferences: reminderPreferences({ turnReminders }) }
}

function reminderTimes(
    fromIndex = FIRST_TURN_REMINDER_INDEX,
    recipient: TurnReminderRecipient = {}
): number[] {
    const now = new Date('2026-10-16T12:00:00.000Z')
    const times: number[] = []
    let elapsed = 0
    let planned = planTurnReminder(fromIndex, now, recipient)
    while (planned) {
        elapsed += planned.inSeconds
        times.push(elapsed)
        planned = planTurnReminder(planned.reminderIndex + 1, now, recipient)
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

describe('chosen turn reminders', () => {
    const allOn = DEFAULT_TURN_REMINDER_CHOICES
    const repeatsFrom = (first: number, every: number, count: number) =>
        Array.from({ length: count }, (_, repeat) => first + repeat * every)

    it('sends every reminder when all are chosen, as with no choice saved', () => {
        expect(reminderTimes(FIRST_TURN_REMINDER_INDEX, choosing(allOn))).toEqual(reminderTimes())
    })

    it('keeps the times of the reminders left on when one is switched off', () => {
        expect(
            reminderTimes(FIRST_TURN_REMINDER_INDEX, choosing({ ...allOn, afterFiveHours: false }))
        ).toEqual([60, 60 + HOUR, 60 + 13 * HOUR, ...repeatsFrom(60 + 25 * HOUR, 12 * HOUR, 14)])
    })

    it('repeats once a day on the second of each pair of twice-daily repeats', () => {
        expect(
            reminderTimes(FIRST_TURN_REMINDER_INDEX, choosing({ ...allOn, repeat: 'daily' }))
        ).toEqual([
            60,
            60 + HOUR,
            60 + 5 * HOUR,
            60 + 13 * HOUR,
            ...repeatsFrom(60 + 37 * HOUR, 24 * HOUR, 7)
        ])
    })

    it('sends only the first reminder when every other one is off', () => {
        const firstOnly = choosing({
            afterOneHour: false,
            afterFiveHours: false,
            afterThirteenHours: false,
            repeat: 'none'
        })
        expect(reminderTimes(FIRST_TURN_REMINDER_INDEX, firstOnly)).toEqual([60])
        expect(reminderTimes(DEFERRED_TURN_REMINDER_INDEX, firstOnly)).toEqual([])
    })

    it('starts a new game from the five and thirteen hour switches', () => {
        expect(
            reminderTimes(
                DEFERRED_TURN_REMINDER_INDEX,
                choosing({ ...allOn, afterFiveHours: false, repeat: 'none' })
            )
        ).toEqual([12 * HOUR])
    })
})

describe('turn reminders in reminder hours', () => {
    const reminderHours = weekReminderHours([18, 19, 20, 21])
    const recipient: TurnReminderRecipient = {
        timeZone: 'America/Chicago',
        preferences: reminderPreferences({ reminderHours })
    }
    const fridayMorning = new Date('2026-10-16T12:00:00.000Z')
    const fridayEvening = new Date('2026-10-16T23:00:00.000Z')
    const secondsUntil = (time: Date) => (time.getTime() - fridayMorning.getTime()) / 1000
    const inSeconds = (fromIndex: number, to: TurnReminderRecipient = recipient) =>
        planTurnReminder(fromIndex, fridayMorning, to)?.inSeconds

    it('sends the first two reminders at their usual delay', () => {
        expect(inSeconds(0)).toBe(60)
        expect(inSeconds(1)).toBe(HOUR)
    })

    it('waits for a reminder hour from the four hour reminder on', () => {
        expect(inSeconds(DEFERRED_TURN_REMINDER_INDEX)).toBe(secondsUntil(fridayEvening))
        expect(inSeconds(3)).toBe(secondsUntil(fridayEvening))
        expect(inSeconds(4)).toBe(12 * HOUR)
    })

    it('waits for a reminder hour when an early reminder is skipped into a later one', () => {
        const skipsOneHour: TurnReminderRecipient = {
            ...recipient,
            preferences: reminderPreferences({
                reminderHours,
                turnReminders: { ...DEFAULT_TURN_REMINDER_CHOICES, afterOneHour: false }
            })
        }
        expect(planTurnReminder(1, fridayMorning, skipsOneHour)).toEqual({
            reminderIndex: DEFERRED_TURN_REMINDER_INDEX,
            inSeconds: secondsUntil(fridayEvening)
        })
    })

    it('keeps the usual delay without reminder hours or a time zone', () => {
        expect(inSeconds(4, {})).toBe(12 * HOUR)
        expect(inSeconds(4, { preferences: recipient.preferences })).toBe(12 * HOUR)
    })
})
