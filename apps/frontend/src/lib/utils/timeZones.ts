import { assertExists } from '@tabletop/common'

type TimeZoneOption = { value: string; name: string }

export function browserTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function timeZoneName(timeZone: string): string {
    return timeZone.replaceAll('_', ' ')
}

export function timeZoneOptions(now: Date, alsoInclude: string[]): TimeZoneOption[] {
    const zones = new Set([...Intl.supportedValuesOf('timeZone'), ...alsoInclude])
    return [...zones]
        .sort()
        .map((zone) => ({ value: zone, name: `${timeZoneName(zone)} (${utcOffset(zone, now)})` }))
}

function utcOffset(timeZone: string, now: Date): string {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value
    assertExists(offset, `No UTC offset for ${timeZone}`)
    return offset
}
