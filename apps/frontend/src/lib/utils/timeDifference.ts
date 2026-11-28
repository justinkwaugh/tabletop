import { wholeHourOffset } from '@tabletop/common'
import { m } from '$lib/paraglide/messages'
import { getLocale } from '$lib/paraglide/runtime'

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

export function viewerTimeOffset(now: Date): number | undefined {
    return wholeHourOffset(Intl.DateTimeFormat().resolvedOptions().timeZone, now)
}

export function timeDifferenceText(theirOffset: number, yourOffset: number): string {
    const hours = theirOffset - yourOffset
    if (hours === 0) return m.time_difference_same()
    return hours > 0
        ? m.time_difference_ahead({ hours })
        : m.time_difference_behind({ hours: -hours })
}

export function theirLocalTimeText(theirOffset: number, now: Date): string {
    const theirClock = new Date(now.getTime() + theirOffset * MILLISECONDS_PER_HOUR)
    const time = new Intl.DateTimeFormat(getLocale(), { hour: 'numeric', timeZone: 'UTC' }).format(
        theirClock
    )
    return m.time_difference_their_time({ time })
}
