import { assert, type ReminderDay, type ReminderHours } from '@tabletop/common'

const HOUR_MS = 60 * 60 * 1000
const SEARCH_HOURS = 8 * 24

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
    const dueLocal = localHour(formatter, due)
    if (isReminderHour(hours, dueLocal)) {
        return due
    }

    const dueHourStart =
        due.getTime() -
        dueLocal.minute * 60 * 1000 -
        due.getUTCSeconds() * 1000 -
        due.getUTCMilliseconds()
    for (let hoursAhead = 1; hoursAhead <= SEARCH_HOURS; hoursAhead++) {
        const candidate = new Date(dueHourStart + hoursAhead * HOUR_MS)
        if (isReminderHour(hours, localHour(formatter, candidate))) {
            return candidate
        }
    }
    assert(false, `No reminder hour within ${SEARCH_HOURS} hours of ${due.toISOString()}`)
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
