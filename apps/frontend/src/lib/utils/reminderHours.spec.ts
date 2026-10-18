import { describe, expect, it } from 'vitest'
import { weekReminderHours } from '@tabletop/common'
import {
    reminderHoursForm,
    reminderHoursFromForm,
    reminderHoursSummary,
    withHour,
    withHourRange
} from './reminderHours.js'

const EVENINGS = [18, 19, 20, 21]
const WEEKEND_DAYS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
const EVERY_HOUR = Array.from({ length: 24 }, (_, hour) => hour)

describe('reminder hours', () => {
    it('saves the same hours for every day without separate weekend hours', () => {
        expect(
            reminderHoursFromForm({ weekday: EVENINGS, weekend: [9], separateWeekend: false })
        ).toEqual(weekReminderHours(EVENINGS))
    })

    it('saves weekend hours for Saturday and Sunday', () => {
        expect(
            reminderHoursFromForm({
                weekday: EVENINGS,
                weekend: WEEKEND_DAYS,
                separateWeekend: true
            })
        ).toEqual(expect.objectContaining({ fri: EVENINGS, sat: WEEKEND_DAYS, sun: WEEKEND_DAYS }))
    })

    it('saves no preference when no hours are selected', () => {
        expect(
            reminderHoursFromForm({ weekday: [], weekend: [], separateWeekend: true })
        ).toBeUndefined()
    })

    it('keeps every hour selected rather than clearing the grid', () => {
        expect(
            reminderHoursFromForm({ weekday: EVERY_HOUR, weekend: [], separateWeekend: false })
        ).toEqual(weekReminderHours(EVERY_HOUR))
    })

    it('shows separate weekend hours only when they differ from weekdays', () => {
        const sameEveryDay = reminderHoursFromForm({
            weekday: EVENINGS,
            weekend: [],
            separateWeekend: false
        })
        expect(reminderHoursForm(sameEveryDay)).toEqual({
            weekday: EVENINGS,
            weekend: EVENINGS,
            separateWeekend: false
        })
        const separate = reminderHoursFromForm({
            weekday: EVENINGS,
            weekend: WEEKEND_DAYS,
            separateWeekend: true
        })
        expect(reminderHoursForm(separate)).toEqual({
            weekday: EVENINGS,
            weekend: WEEKEND_DAYS,
            separateWeekend: true
        })
        expect(reminderHoursForm(undefined)).toEqual({
            weekday: [],
            weekend: [],
            separateWeekend: false
        })
    })

    it('adds and removes an hour, keeping hours in order', () => {
        expect(withHour([18, 20], 19, true)).toEqual([18, 19, 20])
        expect(withHour([18, 19, 20], 19, false)).toEqual([18, 20])
        expect(withHour([18], 18, true)).toEqual([18])
    })

    it('selects or clears every hour between two hours in time order', () => {
        expect(withHourRange([18, 19], 16, 9, true)).toEqual([
            9, 10, 11, 12, 13, 14, 15, 16, 18, 19
        ])
        expect(withHourRange([9, 10, 11, 18], 9, 11, false)).toEqual([18])
    })

    it('summarises hours as time ranges', () => {
        expect(reminderHoursSummary(EVENINGS)).toBe('6 pm–10 pm')
        expect(reminderHoursSummary([7, 8, 18, 19])).toBe('7 am–9 am, 6 pm–8 pm')
        expect(reminderHoursSummary([0, 1, 22, 23])).toBe('10 pm–2 am')
        expect(reminderHoursSummary([])).toBe('Any time')
        expect(reminderHoursSummary(EVERY_HOUR)).toBe('Any time')
    })
})
