import { describe, expect, it } from 'vitest'
import { timeAgoText } from './timeAgoText'

const minutes = (count: number) => count * 60_000
const hours = (count: number) => minutes(60 * count)
const days = (count: number) => hours(24 * count)

describe('timeAgoText', () => {
    it('reads under a minute, or a time slightly ahead of the clock, as just now', () => {
        expect(timeAgoText(30_000)).toBe('just now')
        expect(timeAgoText(-minutes(2))).toBe('just now')
    })

    it('counts down in each unit until twice its size', () => {
        expect(timeAgoText(minutes(1))).toBe('1 min ago')
        expect(timeAgoText(minutes(61))).toBe('61 min ago')
        expect(timeAgoText(minutes(119))).toBe('119 min ago')
        expect(timeAgoText(minutes(150))).toBe('2 h ago')
        expect(timeAgoText(hours(47.9))).toBe('47 h ago')
        expect(timeAgoText(hours(48))).toBe('2 days ago')
        expect(timeAgoText(days(13))).toBe('13 days ago')
        expect(timeAgoText(days(14))).toBe('2 weeks ago')
        expect(timeAgoText(days(59))).toBe('8 weeks ago')
        expect(timeAgoText(days(60))).toBe('2 months ago')
        expect(timeAgoText(days(729))).toBe('24 months ago')
        expect(timeAgoText(days(730))).toBe('2 years ago')
    })
})
