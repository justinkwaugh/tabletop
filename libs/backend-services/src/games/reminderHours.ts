import { assert, type ReminderDay, type ReminderHours } from '@tabletop/common'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
// Two steps per hour covers the extra stop after a clock change that lands mid-hour.
const SEARCH_STEPS = 2 * 8 * 24

const REMINDER_DAY_BY_WEEKDAY: Partial<Record<string, ReminderDay>> = {
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
    Sun: 'sun'
}

type LocalHour = { day: ReminderDay; hour: number; minute: number }

export function nextReminderHour(due: Date, timeZone: string, hours: ReminderHours): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23'
    })
    let candidate = due
    for (let step = 0; step <= SEARCH_STEPS; step++) {
        const local = localHour(formatter, candidate)
        if (isReminderHour(hours, local)) {
            return candidate
        }
        candidate = nextLocalHourStart(candidate, local)
    }
    assert(false, `No reminder hour within a week of ${due.toISOString()}`)
}

function nextLocalHourStart(time: Date, local: LocalHour): Date {
    const intoHour =
        local.minute * MINUTE_MS + time.getUTCSeconds() * 1000 + time.getUTCMilliseconds()
    return new Date(time.getTime() - intoHour + HOUR_MS)
}

function isReminderHour(hours: ReminderHours, { day, hour }: LocalHour): boolean {
    const dayHours = hours[day]
    return dayHours.length === 0 || dayHours.includes(hour)
}

function localHour(formatter: Intl.DateTimeFormat, time: Date): LocalHour {
    const parts = formatter.formatToParts(time)
    const part = (type: Intl.DateTimeFormatPartTypes) => {
        const value = parts.find((candidate) => candidate.type === type)?.value
        assert(value !== undefined, `No ${type} in local time ${time.toISOString()}`)
        return value
    }
    const day = REMINDER_DAY_BY_WEEKDAY[part('weekday')]
    assert(day !== undefined, `Unknown weekday in local time ${time.toISOString()}`)
    return {
        day,
        hour: Number(part('hour')),
        minute: Number(part('minute'))
    }
}
