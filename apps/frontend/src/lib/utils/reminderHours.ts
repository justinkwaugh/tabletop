import { weekReminderHours, type ReminderHours } from '@tabletop/common'

export type ReminderHoursForm = {
    weekday: number[]
    weekend: number[]
    separateWeekend: boolean
}

const HOURS_PER_DAY = 24

export function reminderHoursForm(hours: ReminderHours | undefined): ReminderHoursForm {
    if (!hours) {
        return { weekday: [], weekend: [], separateWeekend: false }
    }
    return {
        weekday: hours.mon,
        weekend: hours.sat,
        separateWeekend: !sameHours(hours.mon, hours.sat)
    }
}

export function reminderHoursFromForm(form: ReminderHoursForm): ReminderHours | undefined {
    const weekend = form.separateWeekend ? form.weekend : form.weekday
    if (form.weekday.length === 0 && weekend.length === 0) {
        return undefined
    }
    return weekReminderHours(form.weekday, weekend)
}

export function withHour(hours: number[], hour: number, selected: boolean): number[] {
    const without = hours.filter((candidate) => candidate !== hour)
    return selected ? [...without, hour].sort((a, b) => a - b) : without
}

export function withHourRange(
    hours: number[],
    from: number,
    to: number,
    selected: boolean
): number[] {
    const range = new Set(
        Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => Math.min(from, to) + index)
    )
    const without = hours.filter((hour) => !range.has(hour))
    return selected ? [...without, ...range].sort((a, b) => a - b) : without
}

export function reminderHoursSummary(sortedHours: number[]): string {
    if (sortedHours.length === 0 || sortedHours.length === HOURS_PER_DAY) {
        return 'Any time'
    }
    return hourRanges(sortedHours)
        .map(([start, end]) => `${hourName(start)}–${hourName(end)}`)
        .join(', ')
}

export function hourLabel(hour: number): string {
    return String(hour % 12 === 0 ? 12 : hour % 12)
}

export function hourName(hour: number): string {
    return `${hourLabel(hour)} ${hour % HOURS_PER_DAY < 12 ? 'am' : 'pm'}`
}

function hourRanges(sortedHours: number[]): [number, number][] {
    const ranges: [number, number][] = []
    for (const hour of sortedHours) {
        const last = ranges.at(-1)
        if (last && last[1] === hour) {
            last[1] = hour + 1
        } else {
            ranges.push([hour, hour + 1])
        }
    }
    const first = ranges[0]
    const last = ranges.at(-1)
    if (ranges.length > 1 && first[0] === 0 && last?.[1] === HOURS_PER_DAY) {
        ranges.pop()
        ranges[0] = [last[0], first[1]]
    }
    return ranges
}

function sameHours(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((hour) => b.includes(hour))
}
