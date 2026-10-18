import { describe, expect, it } from 'vitest'
import {
    emptyHistogram,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    type SiteStatsDay,
    type SiteStatsRange
} from '@tabletop/common'
import {
    bucketLabels,
    chartSlots,
    formatDuration,
    presetRange,
    rangeFigures,
    rangeTotals,
    regroupHistogram,
    slotLatest,
    slotSum,
    titleRows,
    TURN_TIME_DISPLAY_LIMITS
} from './siteStats'

function day(date: string, overrides: Partial<SiteStatsDay> = {}): SiteStatsDay {
    return {
        day: date,
        computedAt: 0,
        rollup: { gamesInPlay: 1, durationMs: 10 },
        newUsers: 1,
        games: { created: 2, started: 1, finished: 1, abandoned: 0 },
        uncountedGamesCreated: { hotseat: 1, forks: 0, explorations: 0 },
        userActions: 10,
        systemActions: 4,
        activeUsers: 3,
        activeUsers7d: 5,
        activeUsers28d: 8,
        turnTimes: emptyHistogram(SITE_TURN_TIME_LIMITS_SECONDS),
        publicFillTimes: emptyHistogram(SITE_TURN_TIME_LIMITS_SECONDS),
        gameLengths: emptyHistogram(SITE_GAME_LENGTH_LIMITS_DAYS),
        titles: {},
        ...overrides
    }
}

function range(from: string, to: string, days: SiteStatsDay[]): SiteStatsRange {
    return { from, to, days, activeUsers: 4, titleActiveUsers: { sol: 3, kaivai: 2 } }
}

describe('site stats ranges', () => {
    it('ends presets yesterday', () => {
        expect(presetRange(28, '2026-10-17')).toEqual({ from: '2026-09-20', to: '2026-10-17' })
    })

    it('compares range figures with the period before', () => {
        const figures = rangeFigures({
            current: range('2026-10-16', '2026-10-17', [day('2026-10-16'), day('2026-10-17')]),
            previous: { ...range('2026-10-14', '2026-10-15', [day('2026-10-14')]), activeUsers: 2 }
        })
        expect(figures[0]).toEqual({
            value: '20',
            label: 'user actions',
            note: '+100% vs previous 2 days'
        })
        expect(figures[1].note).toBe('+100% vs previous 2 days · 5 actions each')
    })

    it('gives one slot per day and leaves days not rolled up empty', () => {
        const slots = chartSlots(
            range('2026-10-15', '2026-10-17', [day('2026-10-15'), day('2026-10-17')])
        )
        expect(slots.map((slot) => slotSum(slot, (entry) => entry.userActions))).toEqual([
            10,
            undefined,
            10
        ])
    })

    it('groups long ranges into weeks, summing counts and keeping the latest trailing value', () => {
        const days = [day('2026-01-01'), day('2026-01-03', { activeUsers7d: 9 })]
        const slots = chartSlots(range('2026-01-01', '2026-12-31', days))
        expect(slots).toHaveLength(53)
        expect(slotSum(slots[0], (entry) => entry.userActions)).toBe(20)
        expect(slotLatest(slots[0], (entry) => entry.activeUsers7d)).toBe(9)
    })
})

describe('site stats totals', () => {
    it('adds days together', () => {
        const totals = rangeTotals([day('2026-10-16'), day('2026-10-17')])
        expect(totals).toMatchObject({
            newUsers: 2,
            userActions: 20,
            systemActions: 8,
            uncountedGamesCreated: { hotseat: 2, forks: 0, explorations: 0 },
            games: { created: 4, started: 2, finished: 2, abandoned: 0 }
        })
    })

    it('ranks titles by user actions with distinct users over the range', () => {
        const title = (userActions: number) => ({
            games: { created: 1, started: 1, finished: 0, abandoned: 0 },
            userActions,
            activeUsers: 1,
            turnTimes: emptyHistogram(SITE_TURN_TIME_LIMITS_SECONDS)
        })
        const rows = titleRows(
            range('2026-10-16', '2026-10-17', [
                day('2026-10-16', { titles: { sol: title(5), kaivai: title(7) } }),
                day('2026-10-17', { titles: { sol: title(4) } })
            ])
        )
        expect(rows.map((row) => [row.titleId, row.userActions, row.games.created, row.activeUsers])).toEqual([
            ['sol', 9, 2, 3],
            ['kaivai', 7, 1, 2]
        ])
    })
})

describe('turn time display', () => {
    it('regroups fine buckets into the displayed ones', () => {
        const fine = emptyHistogram(SITE_TURN_TIME_LIMITS_SECONDS)
        fine[0] = 1
        fine[1] = 2
        fine[2] = 3
        fine[fine.length - 1] = 4
        const grouped = regroupHistogram(fine, SITE_TURN_TIME_LIMITS_SECONDS, TURN_TIME_DISPLAY_LIMITS)
        expect(grouped[0]).toBe(3)
        expect(grouped[1]).toBe(3)
        expect(grouped.at(-1)).toBe(4)
    })

    it('labels the displayed buckets', () => {
        expect(bucketLabels(TURN_TIME_DISPLAY_LIMITS, formatDuration)).toEqual([
            'under 1 min',
            '1 min – 10 min',
            '10 min – 1 h',
            '1 h – 4 h',
            '4 h – 12 h',
            '12 h – 1 d',
            '1 d – 3 d',
            '3 d or more'
        ])
    })
})
