import { describe, expect, it } from 'vitest'
import { GameOutcome } from '@tabletop/common'
import {
    countOf,
    formatAverage,
    formatRate,
    formatRecord,
    monthIn,
    monthlyGames,
    monthName,
    monthsThrough
} from './gameStats'

const month = (year: number, monthOfYear: number) => year * 12 + monthOfYear - 1

describe('game stats presentation', () => {
    it('formats rates, records, and counts', () => {
        expect(formatRate(0.465)).toBe('47%')
        expect(formatRecord({ wins: 45, ties: 3, losses: 52 })).toBe('45–3–52')
        expect(countOf(1, 'opponent')).toBe('1 opponent')
        expect(countOf(4, 'opponent')).toBe('4 opponents')
        expect(formatAverage(2)).toBe('2')
        expect(formatAverage(1.94)).toBe('1.9')
    })

    it('lists every month from the first through the last, across years', () => {
        const months = monthsThrough(month(2025, 11), month(2026, 2))
        expect(months.map((index) => monthName(index, 'short'))).toEqual([
            'Nov 25',
            'Dec 25',
            'Jan 26',
            'Feb 26'
        ])
        expect(monthsThrough(month(2026, 3), month(2026, 3))).toEqual([month(2026, 3)])
        expect(monthsThrough(month(2026, 3), month(2026, 2))).toEqual([])
        expect(monthName(month(2026, 2), 'long')).toBe('February 2026')
    })

    it('places an instant in the calendar month of the given time zone', () => {
        const lateJanuaryInNewYork = Date.UTC(2026, 1, 1, 3)
        expect(monthIn('UTC')(lateJanuaryInNewYork)).toBe(month(2026, 2))
        expect(monthIn('America/New_York')(lateJanuaryInNewYork)).toBe(month(2026, 1))
        expect(monthIn('Pacific/Auckland')(Date.UTC(2025, 11, 31, 12))).toBe(month(2026, 1))
    })

    it("groups Counted Games into the viewer's months, counting wins and ties together", () => {
        const games = [
            { titleId: 'kaivai', finishedAt: Date.UTC(2026, 0, 10), outcome: GameOutcome.Lost },
            { titleId: 'kaivai', finishedAt: Date.UTC(2026, 0, 20), outcome: GameOutcome.Tied },
            { titleId: 'kaivai', finishedAt: Date.UTC(2026, 1, 1, 3), outcome: GameOutcome.Won }
        ]
        expect(monthlyGames(games, monthIn('UTC'))).toEqual([
            { month: month(2026, 1), games: 2, wonOrTied: 1 },
            { month: month(2026, 2), games: 1, wonOrTied: 1 }
        ])
        expect(monthlyGames(games, monthIn('America/New_York'))).toEqual([
            { month: month(2026, 1), games: 3, wonOrTied: 2 }
        ])
    })
})
