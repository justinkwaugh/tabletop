import {
    assertExists,
    PlayOutcome,
    type CountedGame,
    type GameStatsSummary,
    type TitleGameStats
} from '@tabletop/common'

export type CalendarMonth = string

export type MonthlyPlays = { month: CalendarMonth; plays: number; wonOrTied: number }

export type GameStatsScope = {
    id: string
    name: string
    thumbnailUrl?: string
    playsNote: string
    summary: GameStatsSummary
    scores?: TitleGameStats['scores']
    monthlyPlays: MonthlyPlays[]
}

export const localMonth = calendarMonthIn(Intl.DateTimeFormat().resolvedOptions().timeZone)

export function calendarMonthIn(timeZone: string): (time: number) => CalendarMonth {
    const format = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit'
    })
    return (time) => {
        const parts = format.formatToParts(time)
        const year = parts.find((part) => part.type === 'year')
        const month = parts.find((part) => part.type === 'month')
        assertExists(year, 'Formatted date has no year')
        assertExists(month, 'Formatted date has no month')
        return `${year.value}-${month.value}`
    }
}

export function monthlyPlays(
    games: readonly CountedGame[],
    monthOf: (time: number) => CalendarMonth
): MonthlyPlays[] {
    const months = new Map<CalendarMonth, MonthlyPlays>()
    for (const game of games) {
        const month = monthOf(game.finishedAt)
        const entry = months.get(month) ?? { month, plays: 0, wonOrTied: 0 }
        entry.plays += 1
        if (game.outcome !== PlayOutcome.Lost) entry.wonOrTied += 1
        months.set(month, entry)
    }
    return [...months.values()]
}

export function formatRate(rate: number): string {
    return `${Math.round(rate * 100)}%`
}

export function formatRecord(summary: Pick<GameStatsSummary, 'wins' | 'ties' | 'losses'>): string {
    return `${summary.wins}–${summary.ties}–${summary.losses}`
}

export function formatAverage(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function countOf(count: number, noun: string): string {
    return `${count} ${count === 1 ? noun : `${noun}s`}`
}

export function monthName(month: CalendarMonth, style: 'short' | 'long'): string {
    return new Date(`${month}-15T00:00:00Z`).toLocaleDateString('en-US', {
        month: style,
        year: style === 'long' ? 'numeric' : '2-digit',
        timeZone: 'UTC'
    })
}

export function monthsThrough(first: CalendarMonth, last: CalendarMonth): CalendarMonth[] {
    const months: CalendarMonth[] = []
    let [year, month] = first.split('-').map(Number)
    for (;;) {
        const current = `${year}-${String(month).padStart(2, '0')}`
        if (current > last) return months
        months.push(current)
        if (month === 12) {
            year += 1
            month = 1
        } else {
            month += 1
        }
    }
}
