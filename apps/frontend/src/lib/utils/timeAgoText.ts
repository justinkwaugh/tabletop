import { MILLISECONDS_PER_MINUTE } from '@tabletop/common'

const DAYS_PER_MONTH = 30
const DAYS_PER_YEAR = 365

// Each unit takes over at twice its size and counts down, so a time just past a pace never reads as the pace itself.
export function timeAgoText(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / MILLISECONDS_PER_MINUTE)
    if (minutes < 1) return 'just now'
    if (minutes < 120) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 48) return `${hours} h ago`
    const days = Math.floor(hours / 24)
    if (days < 14) return `${days} days ago`
    if (days < 2 * DAYS_PER_MONTH) return `${Math.floor(days / 7)} weeks ago`
    if (days < 2 * DAYS_PER_YEAR) return `${Math.floor(days / DAYS_PER_MONTH)} months ago`
    return `${Math.floor(days / DAYS_PER_YEAR)} years ago`
}
