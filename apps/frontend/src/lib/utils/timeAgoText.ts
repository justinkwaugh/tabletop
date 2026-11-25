import { MILLISECONDS_PER_MINUTE } from '@tabletop/common'
import { m } from '$lib/paraglide/messages'

const DAYS_PER_MONTH = 30
const DAYS_PER_YEAR = 365

// Each unit takes over at twice its size and counts down, so a time just past a pace never reads as the pace itself.
export function timeAgoText(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / MILLISECONDS_PER_MINUTE)
    if (minutes < 1) return m.time_ago_just_now()
    if (minutes < 120) return m.time_ago_minutes({ count: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 48) return m.time_ago_hours({ count: hours })
    const days = Math.floor(hours / 24)
    if (days < 14) return m.time_ago_days({ count: days })
    if (days < 2 * DAYS_PER_MONTH) return m.time_ago_weeks({ count: Math.floor(days / 7) })
    if (days < 2 * DAYS_PER_YEAR) {
        return m.time_ago_months({ count: Math.floor(days / DAYS_PER_MONTH) })
    }
    return m.time_ago_years({ count: Math.floor(days / DAYS_PER_YEAR) })
}
