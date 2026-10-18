import {
    addUtcDays,
    histogramQuantile,
    histogramShareBelow,
    histogramTotal,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    sumHistograms,
    utcDayCount,
    utcDayStart,
    utcDaysThrough,
    type Histogram,
    type SiteGameCounts,
    type SiteStatsDay,
    type SiteStatsRange,
    type SiteTitleDay,
    type UtcDay
} from '@tabletop/common'

export type DayRange = { from: UtcDay; to: UtcDay }

export const RANGE_PRESETS = [7, 28, 90, 365]
export const TURN_TIME_DISPLAY_LIMITS = [60, 600, 3600, 14400, 43200, 86400, 259200]
const WEEKLY_AFTER_DAYS = 120
const DAY_IN_SECONDS = 86400

export type ChartSlot = { start: UtcDay; label: string; days: SiteStatsDay[] }

export type RangeTotals = {
    rolledDays: number
    newUsers: number
    games: SiteGameCounts
    userActions: number
    turnTimes: Histogram
    gameLengths: Histogram
}

export type TurnSummary = {
    turns: number
    median?: number
    p75?: number
    within1h?: number
    within24h?: number
}

export type TitleRow = {
    titleId: string
    created: number
    finished: number
    userActions: number
    activeUsers: number
    turns: TurnSummary
}

const dayLabel = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
})

export function formatUtcDay(day: UtcDay): string {
    return dayLabel.format(utcDayStart(day))
}

export function presetRange(days: number, yesterday: UtcDay): DayRange {
    return { from: addUtcDays(yesterday, 1 - days), to: yesterday }
}

export function previousRange(range: DayRange): DayRange {
    const days = utcDayCount(range.from, range.to)
    return { from: addUtcDays(range.from, -days), to: addUtcDays(range.from, -1) }
}

export function chartSlots(range: SiteStatsRange): ChartSlot[] {
    const byDay = new Map(range.days.map((day) => [day.day, day]))
    const days = utcDaysThrough(range.from, range.to)
    const slotLength = days.length > WEEKLY_AFTER_DAYS ? 7 : 1
    const slots: ChartSlot[] = []
    for (let index = 0; index < days.length; index += slotLength) {
        const slotDays = days.slice(index, index + slotLength)
        slots.push({
            start: slotDays[0],
            label: formatUtcDay(slotDays[0]),
            days: slotDays.flatMap((day) => byDay.get(day) ?? [])
        })
    }
    return slots
}

export function slotsAreWeeks(range: DayRange): boolean {
    return utcDayCount(range.from, range.to) > WEEKLY_AFTER_DAYS
}

export function slotSum(slot: ChartSlot, value: (day: SiteStatsDay) => number) {
    return slot.days.length ? slot.days.reduce((total, day) => total + value(day), 0) : undefined
}

export function slotLatest(slot: ChartSlot, value: (day: SiteStatsDay) => number) {
    const latest = slot.days.at(-1)
    return latest ? value(latest) : undefined
}

export function rangeTotals(days: readonly SiteStatsDay[]): RangeTotals {
    return {
        rolledDays: days.length,
        newUsers: sum(days, (day) => day.newUsers),
        games: gameCounts(days.map((day) => day.games)),
        userActions: sum(days, (day) => day.userActions),
        turnTimes: sumHistograms(
            SITE_TURN_TIME_LIMITS_SECONDS,
            days.map((day) => day.turnTimes)
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
        within1h: histogramShareBelow(limits, turnTimes, 3600),
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
            created: sum(days, (day) => day.games.created),
            finished: sum(days, (day) => day.games.finished),
            userActions: sum(days, (day) => day.userActions),
            activeUsers: range.titleActiveUsers[titleId] ?? 0,
            turns: turnSummary(
                sumHistograms(
                    SITE_TURN_TIME_LIMITS_SECONDS,
                    days.map((day) => day.turnTimes)
                )
            )
        }))
        .sort((a, b) => b.userActions - a.userActions || a.titleId.localeCompare(b.titleId))
}

export function regroupHistogram(
    histogram: Histogram,
    limits: readonly number[],
    displayLimits: readonly number[]
): Histogram {
    const grouped = new Array<number>(displayLimits.length + 1).fill(0)
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
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`
    if (seconds < DAY_IN_SECONDS) return `${trimmed(seconds / 3600)} h`
    return `${trimmed(seconds / DAY_IN_SECONDS)} d`
}

export function formatDays(days: number): string {
    return days < 30 ? `${trimmed(days)} d` : `${trimmed(days / 30.4)} mo`
}

export function changeFrom(current: number, previous: number): number | undefined {
    return previous > 0 ? (current - previous) / previous : undefined
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
