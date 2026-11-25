import { assertExists } from '@tabletop/common'
import { m } from '$lib/paraglide/messages'
import { getLocale } from '$lib/paraglide/runtime'

type TimeZoneOption = { value: string; name: string }

export function browserTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function timeZoneName(timeZone: string): string {
    return timeZone.replaceAll('_', ' ')
}

export function timeZoneOptions(now: Date, alsoInclude: string[]): TimeZoneOption[] {
    const zones = new Set([...Intl.supportedValuesOf('timeZone'), ...alsoInclude])
    return [...zones].sort().map((zone) => ({
        value: zone,
        name: m.content_time_zone_option({
            zone: timeZoneName(zone),
            offset: utcOffset(zone, now)
        })
    }))
}

function utcOffset(timeZone: string, now: Date): string {
    const offset = new Intl.DateTimeFormat(getLocale(), { timeZone, timeZoneName: 'shortOffset' })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value
    assertExists(offset, `No UTC offset for ${timeZone}`)
    return offset
}
