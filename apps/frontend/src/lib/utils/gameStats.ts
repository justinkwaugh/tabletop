import {
    assertExists,
    GameOutcome,
    type CountedGame,
    type GameStatsSummary
} from '@tabletop/common'
import { browserTimeZone } from './timeZones.js'

export type MonthIndex = number

export type MonthlyGames = { month: MonthIndex; games: number; wonOrTied: number }

type ScopedGameStats = {
    name: string
    gamesNote: string
    summary: GameStatsSummary
    monthlyGames: MonthlyGames[]
}

export type GameStatsScope =
    | (ScopedGameStats & { kind: 'all' })
    | (ScopedGameStats & {
          kind: 'title'
          titleId: string
          thumbnailUrl: string
          bestScore?: number
      })

const MONTHS_PER_YEAR = 12

export const localMonth = monthIn(browserTimeZone())

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

export function monthIn(timeZone: string): (time: number) => MonthIndex {
    const format = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric'
    })
    return (time) => {
        const parts = format.formatToParts(time)
        const year = parts.find((part) => part.type === 'year')
        const month = parts.find((part) => part.type === 'month')
        assertExists(year, 'Formatted date has no year')
        assertExists(month, 'Formatted date has no month')
        return Number(year.value) * MONTHS_PER_YEAR + Number(month.value) - 1
    }
}

export function monthName(month: MonthIndex, style: 'short' | 'long'): string {
    const date = new Date(
        Date.UTC(Math.floor(month / MONTHS_PER_YEAR), month % MONTHS_PER_YEAR, 15)
    )
    return date.toLocaleDateString('en-US', {
        month: style,
        year: style === 'long' ? 'numeric' : '2-digit',
        timeZone: 'UTC'
    })
}

export function monthsThrough(first: MonthIndex, last: MonthIndex): MonthIndex[] {
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => first + offset)
}

export function monthlyGames(
    games: readonly CountedGame[],
    monthOf: (time: number) => MonthIndex
): MonthlyGames[] {
    const months = new Map<MonthIndex, MonthlyGames>()
    for (const game of games) {
        const month = monthOf(game.finishedAt)
        const entry = months.get(month) ?? { month, games: 0, wonOrTied: 0 }
        entry.games += 1
        if (game.outcome !== GameOutcome.Lost) entry.wonOrTied += 1
        months.set(month, entry)
    }
    return [...months.values()]
}
