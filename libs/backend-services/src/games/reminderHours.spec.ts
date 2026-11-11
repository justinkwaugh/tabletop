import { describe, expect, it } from 'vitest'
import { weekReminderHours, type ReminderHours } from '@tabletop/common'
import { nextReminderHour } from './reminderHours.js'

const EVENINGS = [18, 19, 20, 21]
const WEEKEND_DAYS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

function alignedTime(due: string, timeZone: string, hours: ReminderHours): string {
    return nextReminderHour(new Date(due), timeZone, hours).toISOString()
}

describe('next reminder hour', () => {
    it('keeps a time that is already in a selected hour', () => {
        expect(
            alignedTime('2026-10-17T00:20:00.000Z', 'America/Chicago', weekReminderHours(EVENINGS))
        ).toBe('2026-10-17T00:20:00.000Z')
    })

    it('moves a time to the start of the next selected local hour', () => {
        expect(
            alignedTime('2026-10-16T12:00:00.000Z', 'America/Chicago', weekReminderHours(EVENINGS))
        ).toBe('2026-10-16T23:00:00.000Z')
    })

    it('uses the hours of the local day it moves into', () => {
        expect(
            alignedTime(
                '2026-10-17T03:41:00.000Z',
                'America/Chicago',
                weekReminderHours(EVENINGS, WEEKEND_DAYS)
            )
        ).toBe('2026-10-17T14:00:00.000Z')
    })

    it('treats a day with no selected hours as any time', () => {
        expect(
            alignedTime(
                '2026-10-18T08:00:00.000Z',
                'America/Chicago',
                weekReminderHours(EVENINGS, [])
            )
        ).toBe('2026-10-18T08:00:00.000Z')
    })

    it('starts local hours in zones offset by half an hour', () => {
        expect(
            alignedTime('2026-10-14T09:40:00.000Z', 'Asia/Kolkata', weekReminderHours([16]))
        ).toBe('2026-10-14T10:30:00.000Z')
    })

    it('skips a selected hour the clocks jump over', () => {
        expect(
            alignedTime('2026-03-08T07:30:00.000Z', 'America/Chicago', weekReminderHours([2]))
        ).toBe('2026-03-09T07:00:00.000Z')
    })

    it('counts a selected hour the clocks repeat both times', () => {
        const hours = weekReminderHours([1])
        expect(alignedTime('2026-11-01T06:30:00.000Z', 'America/Chicago', hours)).toBe(
            '2026-11-01T06:30:00.000Z'
        )
        expect(alignedTime('2026-11-01T07:15:00.000Z', 'America/Chicago', hours)).toBe(
            '2026-11-01T07:15:00.000Z'
        )
    })

    it('starts the selected hour on time after a half-hour clock change', () => {
        expect(
            alignedTime('2026-10-03T14:30:00.000Z', 'Australia/Lord_Howe', weekReminderHours([3]))
        ).toBe('2026-10-03T16:00:00.000Z')
    })
})
