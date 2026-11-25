import type { Locale } from '../i18n.js'

// A reader whose time zone the site never learned is told the time in UTC, which the email names.
const UNKNOWN_TIME_ZONE = 'UTC'

function formatEmailTime(
    time: Date | number,
    locale: Locale,
    timeZone: string | undefined,
    date: Intl.DateTimeFormatOptions,
): string {
    return new Intl.DateTimeFormat(locale, {
        ...date,
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timeZone ?? UNKNOWN_TIME_ZONE,
        timeZoneName: 'short',
    }).format(time)
}

export const formatEmailTimestamp = (time: Date, locale: Locale, timeZone: string | undefined) =>
    formatEmailTime(time, locale, timeZone, { year: 'numeric', month: 'long', day: 'numeric' })

export const formatEmailDeadline = (time: number, locale: Locale, timeZone: string | undefined) =>
    formatEmailTime(time, locale, timeZone, { weekday: 'long', month: 'long', day: 'numeric' })
