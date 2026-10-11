import { describe, expect, it } from 'vitest'
import { PlayOutcome } from '@tabletop/common'
import {
    calendarMonthIn,
    countOf,
    formatRate,
    formatRecord,
    monthlyPlays,
    monthName,
    monthsThrough
} from './gameStats'

describe('game stats presentation', () => {
    it('formats rates, records, and counts', () => {
        expect(formatRate(0.465)).toBe('47%')
        expect(formatRecord({ wins: 45, ties: 3, losses: 52 })).toBe('45–3–52')
        expect(countOf(1, 'opponent')).toBe('1 opponent')
        expect(countOf(4, 'opponent')).toBe('4 opponents')
    })

    it('lists every month from the first through the last, across years', () => {
        expect(monthsThrough('2025-11', '2026-02')).toEqual([
            '2025-11',
            '2025-12',
            '2026-01',
            '2026-02'
        ])
        expect(monthsThrough('2026-03', '2026-03')).toEqual(['2026-03'])
        expect(monthName('2026-02', 'short')).toBe('Feb 26')
        expect(monthName('2026-02', 'long')).toBe('February 2026')
    })

    it('places an instant in the calendar month of the given time zone', () => {
        const lateJanuaryInNewYork = Date.UTC(2026, 1, 1, 3)
        expect(calendarMonthIn('UTC')(lateJanuaryInNewYork)).toBe('2026-02')
        expect(calendarMonthIn('America/New_York')(lateJanuaryInNewYork)).toBe('2026-01')
        expect(calendarMonthIn('Pacific/Auckland')(Date.UTC(2025, 11, 31, 12))).toBe('2026-01')
    })

    it("groups Counted Games into the viewer's months, counting wins and ties together", () => {
        const games = [
            { titleId: 'kaivai', finishedAt: Date.UTC(2026, 0, 10), outcome: PlayOutcome.Lost },
            { titleId: 'kaivai', finishedAt: Date.UTC(2026, 0, 20), outcome: PlayOutcome.Tied },
            { titleId: 'kaivai', finishedAt: Date.UTC(2026, 1, 1, 3), outcome: PlayOutcome.Won }
        ]
        expect(monthlyPlays(games, calendarMonthIn('UTC'))).toEqual([
            { month: '2026-01', plays: 2, wonOrTied: 1 },
            { month: '2026-02', plays: 1, wonOrTied: 1 }
        ])
        expect(monthlyPlays(games, calendarMonthIn('America/New_York'))).toEqual([
            { month: '2026-01', plays: 3, wonOrTied: 2 }
        ])
    })
})
