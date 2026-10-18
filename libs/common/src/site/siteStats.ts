import * as Type from 'typebox'

export const MILLISECONDS_PER_DAY = 86_400_000
export const SITE_STATS_MAX_RANGE_DAYS = 400

export const SITE_TURN_TIME_LIMITS_SECONDS = [
    30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200, 57600, 86400,
    129600, 172800, 259200, 432000, 604800
]
export const SITE_GAME_LENGTH_LIMITS_DAYS = [1, 3, 7, 14, 28, 61]

export const UtcDay = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
export type UtcDay = Type.Static<typeof UtcDay>

export const Histogram = Type.Array(Type.Integer({ minimum: 0 }))
export type Histogram = Type.Static<typeof Histogram>

export const SiteGameCounts = Type.Object(
    {
        created: Type.Integer({ minimum: 0 }),
        started: Type.Integer({ minimum: 0 }),
        finished: Type.Integer({ minimum: 0 }),
        abandoned: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type SiteGameCounts = Type.Static<typeof SiteGameCounts>

export const SiteTitleDay = Type.Object(
    {
        games: SiteGameCounts,
        userActions: Type.Integer({ minimum: 0 }),
        activeUsers: Type.Integer({ minimum: 0 }),
        turnTimes: Histogram
    },
    { additionalProperties: false }
)
export type SiteTitleDay = Type.Static<typeof SiteTitleDay>

export const SiteStatsDay = Type.Object(
    {
        day: UtcDay,
        computedAt: Type.Integer(),
        newUsers: Type.Integer({ minimum: 0 }),
        games: SiteGameCounts,
        userActions: Type.Integer({ minimum: 0 }),
        activeUsers: Type.Integer({ minimum: 0 }),
        activeUsers7d: Type.Integer({ minimum: 0 }),
        activeUsers28d: Type.Integer({ minimum: 0 }),
        turnTimes: Histogram,
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
        rolledThrough: Type.Optional(UtcDay),
        days: Type.Array(SiteStatsDay),
        activeUsers: Type.Integer({ minimum: 0 }),
        titleActiveUsers: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
    },
    { additionalProperties: false }
)
export type SiteStatsRange = Type.Static<typeof SiteStatsRange>

export const SiteStatsNow = Type.Object(
    {
        asOf: Type.Integer(),
        users: Type.Object(
            {
                active: Type.Integer({ minimum: 0 }),
                incomplete: Type.Integer({ minimum: 0 }),
                inactive: Type.Integer({ minimum: 0 }),
                deleted: Type.Integer({ minimum: 0 })
            },
            { additionalProperties: false }
        ),
        games: Type.Object(
            {
                waitingForPlayers: Type.Integer({ minimum: 0 }),
                waitingToStart: Type.Integer({ minimum: 0 }),
                started: Type.Integer({ minimum: 0 }),
                finished: Type.Integer({ minimum: 0 }),
                quietFor7Days: Type.Integer({ minimum: 0 }),
                quietFor30Days: Type.Integer({ minimum: 0 })
            },
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

export function addUtcDays(day: UtcDay, days: number): UtcDay {
    return utcDayOf(new Date(utcDayStart(day).getTime() + days * MILLISECONDS_PER_DAY))
}

export function isRealUtcDay(day: UtcDay): boolean {
    const start = utcDayStart(day)
    return !Number.isNaN(start.getTime()) && utcDayOf(start) === day
}

export function utcDayCount(from: UtcDay, to: UtcDay): number {
    return Math.round((utcDayStart(to).getTime() - utcDayStart(from).getTime()) / MILLISECONDS_PER_DAY) + 1
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
