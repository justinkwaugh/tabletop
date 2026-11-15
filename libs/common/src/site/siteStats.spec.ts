import { describe, expect, it } from 'vitest'
import {
    addUtcDays,
    histogramQuantile,
    histogramShareBelow,
    isRealUtcDay,
    utcDayCount,
    utcDaysThrough
} from './siteStats.js'

describe('UTC days', () => {
    it('steps across month and year ends', () => {
        expect(addUtcDays('2026-12-31', 1)).toBe('2027-01-01')
        expect(addUtcDays('2026-03-01', -1)).toBe('2026-02-28')
        expect(utcDaysThrough('2026-10-30', '2026-11-02')).toEqual([
            '2026-10-30',
            '2026-10-31',
            '2026-11-01',
            '2026-11-02'
        ])
        expect(utcDayCount('2026-10-01', '2026-10-31')).toBe(31)
    })

    it('rejects days that do not exist', () => {
        expect(isRealUtcDay('2026-02-29')).toBe(false)
        expect(isRealUtcDay('2026-13-01')).toBe(false)
        expect(isRealUtcDay('2028-02-29')).toBe(true)
    })
})

describe('histograms', () => {
    const limits = [10, 20, 40]

    it('interpolates a quantile inside its bucket', () => {
        expect(histogramQuantile(limits, [0, 4, 0, 0], 0.5)).toBe(15)
        expect(histogramQuantile(limits, [2, 0, 2, 0], 0.75)).toBe(30)
        expect(histogramQuantile(limits, [0, 0, 0, 3], 0.5)).toBe(40)
        expect(histogramQuantile(limits, [0, 0, 0, 0], 0.5)).toBeUndefined()
    })

    it('measures the share below a limit', () => {
        expect(histogramShareBelow(limits, [1, 1, 1, 1], 20)).toBe(0.5)
    })
})
