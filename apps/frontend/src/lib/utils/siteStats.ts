import {
    addUtcDays,
    emptyHistogram,
    histogramQuantile,
    histogramShareBelow,
    histogramTotal,
    SITE_FILL_TIME_LIMITS_SECONDS,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    sumHistograms,
    utcDayCount,
    utcDayStart,
    utcDaysThrough,
    type Histogram,
    type RelayCounts,
    type SiteGameCounts,
    type SiteStatsDay,
    type SiteStatsNow,
    type SiteStatsRange,
    type SiteStatsReport,
    type SiteTitleDay,
    type UtcDay,
    type UtcDayRange
} from '@tabletop/common'
import { formatRate } from './gameStats'
import type { SiteChartSeries } from './siteStatsChart'

export const RANGE_PRESETS = [7, 28, 90, 365]
export const TURN_TIME_DISPLAY_LIMITS = [60, 600, 3600, 14400, 43200, 86400, 259200]
const WEEKLY_AFTER_DAYS = 120
const DAY_IN_SECONDS = 86400
const HOUR_IN_SECONDS = 3600

export type ChartSlot = { label: string; days: SiteStatsDay[] }

export type StatFigure = { value: string; label: string; note?: string }

export type RangeTotals = Pick<
    SiteStatsDay,
    | 'newUsers'
    | 'games'
    | 'uncountedGamesCreated'
    | 'userActions'
    | 'automaticActions'
    | 'turnTimes'
    | 'publicFillTimes'
    | 'gameLengths'
>

export type TurnSummary = {
    turns: number
    median?: number
    p75?: number
    within1h?: number
    within24h?: number
}

export type TitleRow = {
    titleId: string
    games: SiteGameCounts
    userActions: number
    activeUsers: number
    turns: TurnSummary
}

const dayLabel = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
})

const dateLabel = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
})

export function formatUtcDay(day: UtcDay): string {
    return dayLabel.format(utcDayStart(day))
}

export function formatUtcDate(day: UtcDay): string {
    return dateLabel.format(utcDayStart(day))
}

export function formatUtcRange(range: UtcDayRange): string {
    const format = range.from.slice(0, 4) === range.to.slice(0, 4) ? formatUtcDay : formatUtcDate
    return `${format(range.from)} – ${format(range.to)}`
}

export function presetRange(days: number, yesterday: UtcDay): UtcDayRange {
    return { from: addUtcDays(yesterday, 1 - days), to: yesterday }
}

export function slotsAreWeeks(range: UtcDayRange): boolean {
    return utcDayCount(range.from, range.to) > WEEKLY_AFTER_DAYS
}

export function chartSlots(range: SiteStatsRange): ChartSlot[] {
    const byDay = new Map(range.days.map((day) => [day.day, day]))
    const days = utcDaysThrough(range.from, range.to)
    const slotLength = slotsAreWeeks(range) ? 7 : 1
    const slots: ChartSlot[] = []
    for (let index = 0; index < days.length; index += slotLength) {
        const slotDays = days.slice(index, index + slotLength)
        slots.push({
            label: formatUtcDay(slotDays[0]),
            days: slotDays.flatMap((day) => byDay.get(day) ?? [])
        })
    }
    return slots
}

export function slotSum(slot: ChartSlot, value: (day: SiteStatsDay) => number) {
    return slot.days.length ? sum(slot.days, value) : undefined
}

export function slotLatest(slot: ChartSlot, value: (day: SiteStatsDay) => number) {
    const latest = slot.days.at(-1)
    return latest ? value(latest) : undefined
}

export function userActionSeries(slots: ChartSlot[]): SiteChartSeries[] {
    return [columns('actions', 'User actions', 'blue', slots, (day) => day.userActions)]
}

export function activeUserSeries(slots: ChartSlot[], weekly: boolean): SiteChartSeries[] {
    return [
        ...(weekly ? [] : [columns('daily', 'That day', 'blue', slots, (day) => day.activeUsers)]),
        {
            key: 'week',
            name: 'Trailing 7 days',
            tone: 'orange',
            kind: 'line',
            values: slots.map((slot) => slotLatest(slot, (day) => day.activeUsers7d))
        },
        {
            key: 'month',
            name: 'Trailing 28 days',
            tone: 'green',
            kind: 'line',
            values: slots.map((slot) => slotLatest(slot, (day) => day.activeUsers28d))
        }
    ]
}

export function gameSeries(slots: ChartSlot[]): SiteChartSeries[] {
    return [
        columns('created', 'Created', 'blue', slots, (day) => day.games.created),
        columns('started', 'Started', 'orange', slots, (day) => day.games.started),
        columns('finished', 'Finished', 'green', slots, (day) => day.games.finished)
    ]
}

export function newUserSeries(slots: ChartSlot[]): SiteChartSeries[] {
    return [columns('users', 'New users', 'blue', slots, (day) => day.newUsers)]
}

export function rangeTotals(days: readonly SiteStatsDay[]): RangeTotals {
    return {
        newUsers: sum(days, (day) => day.newUsers),
        games: gameCounts(days.map((day) => day.games)),
        uncountedGamesCreated: {
            hotseat: sum(days, (day) => day.uncountedGamesCreated.hotseat),
            forks: sum(days, (day) => day.uncountedGamesCreated.forks),
            explorations: sum(days, (day) => day.uncountedGamesCreated.explorations)
        },
        userActions: sum(days, (day) => day.userActions),
        automaticActions: sum(days, (day) => day.automaticActions),
        turnTimes: turnHistogram(days.map((day) => day.turnTimes)),
        publicFillTimes: sumHistograms(
            SITE_FILL_TIME_LIMITS_SECONDS,
            days.map((day) => day.publicFillTimes)
        ),
        gameLengths: sumHistograms(
            SITE_GAME_LENGTH_LIMITS_DAYS,
            days.map((day) => day.gameLengths)
        )
    }
}

export function turnSummary(turnTimes: Histogram): TurnSummary {
    const limits = SITE_TURN_TIME_LIMITS_SECONDS
    return {
        turns: histogramTotal(turnTimes),
        median: histogramQuantile(limits, turnTimes, 0.5),
        p75: histogramQuantile(limits, turnTimes, 0.75),
        within1h: histogramShareBelow(limits, turnTimes, HOUR_IN_SECONDS),
        within24h: histogramShareBelow(limits, turnTimes, DAY_IN_SECONDS)
    }
}

export function titleRows(range: SiteStatsRange): TitleRow[] {
    const byTitle = new Map<string, SiteTitleDay[]>()
    for (const day of range.days)
        for (const [titleId, title] of Object.entries(day.titles))
            byTitle.set(titleId, [...(byTitle.get(titleId) ?? []), title])
    return [...byTitle]
        .map(([titleId, days]) => ({
            titleId,
            games: gameCounts(days.map((day) => day.games)),
            userActions: sum(days, (day) => day.userActions),
            activeUsers: range.titleActiveUsers[titleId],
            turns: turnSummary(turnHistogram(days.map((day) => day.turnTimes)))
        }))
        .sort((a, b) => b.userActions - a.userActions || a.titleId.localeCompare(b.titleId))
}

export function regroupHistogram(
    histogram: Histogram,
    limits: readonly number[],
    displayLimits: readonly number[]
): Histogram {
    const grouped = emptyHistogram(displayLimits)
    histogram.forEach((count, bucket) => {
        const upper = limits[bucket] ?? Infinity
        grouped[displayLimits.filter((limit) => limit < upper).length] += count
    })
    return grouped
}

export function bucketLabels(limits: readonly number[], format: (value: number) => string) {
    return [
        `under ${format(limits[0])}`,
        ...limits.slice(1).map((limit, index) => `${format(limits[index])} – ${format(limit)}`),
        `${format(limits[limits.length - 1])} or more`
    ]
}

export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)} s`
    if (seconds < HOUR_IN_SECONDS) return `${Math.round(seconds / 60)} min`
    if (seconds < DAY_IN_SECONDS) return `${trimmed(seconds / HOUR_IN_SECONDS)} h`
    return `${trimmed(seconds / DAY_IN_SECONDS)} d`
}

export function formatDays(days: number): string {
    return days < 30 ? `${trimmed(days)} d` : `${trimmed(days / 30.4)} mo`
}

export function changeFrom(current: number, previous: number): number | undefined {
    return previous > 0 ? (current - previous) / previous : undefined
}

export type RelayStatsState = {
    available: boolean
    live: boolean
    counts: RelayCounts | undefined
}

export function onlineFigure({ available, live, counts }: RelayStatsState): StatFigure {
    const label = 'people online now'
    if (!available) return { value: '—', label, note: 'needs the realtime relay' }
    if (!live) return { value: '—', label, note: 'connecting to the relay' }
    if (!counts) return { value: '—', label, note: 'no count from the relay yet' }
    return {
        value: count(counts.accounts),
        label,
        note: `${count(counts.connections)} ${counts.connections === 1 ? 'tab' : 'tabs'} open`
    }
}

export function nowFigures(now: SiteStatsNow): StatFigure[] {
    const { users, games } = now
    return [
        {
            value: count(users.active),
            label: 'users',
            note: `${users.incomplete} incomplete · ${users.inactive} inactive`
        },
        {
            value: count(games.started),
            label: 'games in progress',
            note: `${games.waitingForPlayers} waiting for players · ${games.waitingToStart} waiting to start`
        },
        { value: count(games.finished), label: 'games finished all time' },
        {
            value: count(games.quietFor7Days),
            label: 'in progress, quiet 7+ days',
            note: `${games.quietFor30Days} of them 30+ days`
        }
    ]
}

export function rangeFigures(report: SiteStatsReport): StatFigure[] {
    const { current, previous } = report
    const totals = rangeTotals(current.days)
    const earlier = rangeTotals(previous.days)
    const turns = turnSummary(totals.turnTimes)
    const days = utcDayCount(current.from, current.to)
    const comparable = report.rolledFrom !== undefined && previous.from >= report.rolledFrom
    const change = (now: number, before: number) => {
        const ratio = comparable ? changeFrom(now, before) : undefined
        if (ratio === undefined) return undefined
        const sign = ratio > 0 ? '+' : ratio < 0 ? '−' : '±'
        return `${sign}${formatRate(Math.abs(ratio))} vs previous ${days} days`
    }
    const perUser = current.activeUsers ? totals.userActions / current.activeUsers : undefined
    return [
        {
            value: count(totals.userActions),
            label: 'user actions',
            note: change(totals.userActions, earlier.userActions)
        },
        {
            value: count(current.activeUsers),
            label: 'active users',
            note: joinNotes(
                change(current.activeUsers, previous.activeUsers),
                perUser === undefined ? undefined : `${trimmed(perUser)} actions each`
            )
        },
        {
            value: count(totals.games.created),
            label: 'games created',
            note: change(totals.games.created, earlier.games.created)
        },
        {
            value: count(totals.newUsers),
            label: 'new users',
            note: change(totals.newUsers, earlier.newUsers)
        },
        {
            value: turns.median === undefined ? '–' : `≈ ${formatDuration(turns.median)}`,
            label: 'median turn',
            note:
                turns.within24h === undefined
                    ? undefined
                    : `${formatRate(turns.within24h)} within 24 h`
        }
    ]
}

function joinNotes(...notes: (string | undefined)[]): string | undefined {
    return notes.filter((note) => note !== undefined).join(' · ') || undefined
}

function count(value: number): string {
    return value.toLocaleString()
}

function columns(
    key: string,
    name: string,
    tone: SiteChartSeries['tone'],
    slots: ChartSlot[],
    value: (day: SiteStatsDay) => number
): SiteChartSeries {
    return { key, name, tone, kind: 'column', values: slots.map((slot) => slotSum(slot, value)) }
}

function turnHistogram(histograms: Histogram[]): Histogram {
    return sumHistograms(SITE_TURN_TIME_LIMITS_SECONDS, histograms)
}

function trimmed(value: number): string {
    return value < 10 ? value.toFixed(1).replace(/\.0$/, '') : String(Math.round(value))
}

function gameCounts(counts: readonly SiteGameCounts[]): SiteGameCounts {
    return {
        created: sum(counts, (count) => count.created),
        started: sum(counts, (count) => count.started),
        finished: sum(counts, (count) => count.finished),
        abandoned: sum(counts, (count) => count.abandoned)
    }
}

function sum<T>(items: readonly T[], value: (item: T) => number): number {
    return items.reduce((total, item) => total + value(item), 0)
}
