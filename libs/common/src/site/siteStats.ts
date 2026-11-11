import * as Type from 'typebox'

export const MILLISECONDS_PER_DAY = 86_400_000
export const SITE_STATS_MAX_RANGE_DAYS = 400

export const SITE_TURN_TIME_LIMITS_SECONDS = [
    30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200, 57600, 86400,
    129600, 172800, 259200, 432000, 604800
]
export const SITE_FILL_TIME_LIMITS_SECONDS = [
    600, 3600, 14400, 43200, 86400, 259200, 604800, 1209600
]
export const SITE_GAME_LENGTH_LIMITS_DAYS = [1, 3, 7, 14, 28, 61]

export type TimeWindow = { start: Date; end: Date }

export const UtcDay = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
export type UtcDay = Type.Static<typeof UtcDay>

export const Histogram = Type.Array(Type.Integer({ minimum: 0 }))
export type Histogram = Type.Static<typeof Histogram>

export const UtcDayRange = Type.Object(
    { from: UtcDay, to: UtcDay },
    { additionalProperties: false }
)
export type UtcDayRange = Type.Static<typeof UtcDayRange>

const Count = Type.Integer({ minimum: 0 })

export const SiteGameCounts = Type.Object(
    { created: Count, started: Count, finished: Count, abandoned: Count },
    { additionalProperties: false }
)
export type SiteGameCounts = Type.Static<typeof SiteGameCounts>

export const SiteTitleDay = Type.Object(
    {
        games: SiteGameCounts,
        userActions: Count,
        activeUsers: Count,
        turnTimes: Histogram
    },
    { additionalProperties: false }
)
export type SiteTitleDay = Type.Static<typeof SiteTitleDay>

export const SiteStatsDay = Type.Object(
    {
        day: UtcDay,
        computedAt: Type.Integer(),
        rollup: Type.Object(
            { gamesInPlay: Count, durationMs: Count },
            { additionalProperties: false }
        ),
        newUsers: Count,
        games: SiteGameCounts,
        uncountedGamesCreated: Type.Object(
            { hotseat: Count, forks: Count, explorations: Count },
            { additionalProperties: false }
        ),
        userActions: Count,
        automaticActions: Count,
        activeUsers: Count,
        activeUsers7d: Count,
        activeUsers28d: Count,
        turnTimes: Histogram,
        publicFillTimes: Histogram,
        gameLengths: Histogram,
        titles: Type.Record(Type.String(), SiteTitleDay)
    },
    { additionalProperties: false }
)
export type SiteStatsDay = Type.Static<typeof SiteStatsDay>

export const SiteStatsRange = Type.Object(
    {
        from: UtcDay,
        to: UtcDay,
        days: Type.Array(SiteStatsDay),
        activeUsers: Count,
        titleActiveUsers: Type.Record(Type.String(), Count)
    },
    { additionalProperties: false }
)
export type SiteStatsRange = Type.Static<typeof SiteStatsRange>

export const SiteStatsReport = Type.Object(
    {
        rolledFrom: Type.Optional(UtcDay),
        latest: Type.Optional(SiteStatsDay),
        current: SiteStatsRange,
        previous: SiteStatsRange
    },
    { additionalProperties: false }
)
export type SiteStatsReport = Type.Static<typeof SiteStatsReport>

export const SiteStatsNow = Type.Object(
    {
        asOf: Type.Integer(),
        users: Type.Object(
            { active: Count, incomplete: Count, inactive: Count, deleted: Count },
            { additionalProperties: false }
        ),
        games: Type.Object(
            {
                waitingForPlayers: Count,
                waitingToStart: Count,
                started: Count,
                finished: Count,
                quietFor7Days: Count,
                quietFor30Days: Count
            },
            { additionalProperties: false }
        ),
        notificationClients: Type.Object(
            { webPush: Count, discord: Count },
            { additionalProperties: false }
        )
    },
    { additionalProperties: false }
)
export type SiteStatsNow = Type.Static<typeof SiteStatsNow>

export function utcDayOf(instant: Date): UtcDay {
    return instant.toISOString().slice(0, 10)
}

export function utcDayStart(day: UtcDay): Date {
    return new Date(`${day}T00:00:00.000Z`)
}

export function utcDayWindow(day: UtcDay): TimeWindow {
    const start = utcDayStart(day)
    return { start, end: new Date(start.getTime() + MILLISECONDS_PER_DAY) }
}

export function addUtcDays(day: UtcDay, days: number): UtcDay {
    return utcDayOf(new Date(utcDayStart(day).getTime() + days * MILLISECONDS_PER_DAY))
}

export function isRealUtcDay(day: UtcDay): boolean {
    const start = utcDayStart(day)
    return !Number.isNaN(start.getTime()) && utcDayOf(start) === day
}

export function utcDayCount(from: UtcDay, to: UtcDay): number {
    return (
        Math.round(
            (utcDayStart(to).getTime() - utcDayStart(from).getTime()) / MILLISECONDS_PER_DAY
        ) + 1
    )
}

export function utcMonthOf(day: UtcDay): string {
    return day.slice(0, 7)
}

export function previousUtcRange(range: UtcDayRange): UtcDayRange {
    const days = utcDayCount(range.from, range.to)
    return { from: addUtcDays(range.from, -days), to: addUtcDays(range.from, -1) }
}

export function utcRangeProblem(
    range: UtcDayRange,
    latest: UtcDay,
    maxDays = SITE_STATS_MAX_RANGE_DAYS
): string | undefined {
    if (!isRealUtcDay(range.from) || !isRealUtcDay(range.to)) return 'Both ends must be real days'
    if (range.from > range.to) return 'The range must not end before it starts'
    if (range.to > latest) return `The range must end by ${latest}`
    if (utcDayCount(range.from, range.to) > maxDays)
        return `The range may span at most ${maxDays} days`
    return undefined
}

export function utcDaysThrough(from: UtcDay, to: UtcDay): UtcDay[] {
    const days: UtcDay[] = []
    for (let day = from; day <= to; day = addUtcDays(day, 1)) days.push(day)
    return days
}

export function emptyHistogram(limits: readonly number[]): Histogram {
    return new Array<number>(limits.length + 1).fill(0)
}

export function histogramBucket(limits: readonly number[], value: number): number {
    const bucket = limits.findIndex((limit) => value < limit)
    return bucket === -1 ? limits.length : bucket
}

export function addToHistogram(histogram: Histogram, limits: readonly number[], value: number) {
    histogram[histogramBucket(limits, value)] += 1
}

export function sumHistograms(limits: readonly number[], histograms: readonly Histogram[]) {
    const total = emptyHistogram(limits)
    for (const histogram of histograms)
        histogram.forEach((count, bucket) => (total[bucket] += count))
    return total
}

export function histogramTotal(histogram: Histogram): number {
    return histogram.reduce((total, count) => total + count, 0)
}

export function histogramQuantile(
    limits: readonly number[],
    histogram: Histogram,
    quantile: number
): number | undefined {
    const total = histogramTotal(histogram)
    if (total === 0) return undefined
    const target = quantile * total
    let below = 0
    for (const [bucket, count] of histogram.entries()) {
        if (count > 0 && below + count >= target) {
            const lower = bucket === 0 ? 0 : limits[bucket - 1]
            if (bucket === limits.length) return lower
            return lower + ((target - below) / count) * (limits[bucket] - lower)
        }
        below += count
    }
    return limits.at(-1)
}

export function histogramShareBelow(
    limits: readonly number[],
    histogram: Histogram,
    limit: number
): number | undefined {
    const total = histogramTotal(histogram)
    if (total === 0) return undefined
    const buckets = limits.indexOf(limit)
    if (buckets === -1) throw new Error(`${limit} is not a histogram limit`)
    return histogramTotal(histogram.slice(0, buckets + 1)) / total
}
