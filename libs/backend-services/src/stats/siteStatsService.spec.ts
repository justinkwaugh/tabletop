import { describe, expect, it, vi } from 'vitest'
import {
    emptyHistogram,
    SITE_FILL_TIME_LIMITS_SECONDS,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    type SiteStatsDay,
    type UtcDay
} from '@tabletop/common'
import type { CreatePushTaskOptions } from '../tasks/taskService.js'
import { InvalidSiteStatsRangeError, SiteStatsService } from './siteStatsService.js'

function rolledDay(day: UtcDay): SiteStatsDay {
    const games = { created: 0, started: 0, finished: 0, abandoned: 0 }
    return {
        day,
        computedAt: 0,
        rollup: { gamesInPlay: 0, durationMs: 0 },
        newUsers: 0,
        games,
        uncountedGamesCreated: { hotseat: 0, forks: 0, explorations: 0 },
        userActions: 0,
        automaticActions: 0,
        activeUsers: 0,
        activeUsers7d: 0,
        activeUsers28d: 0,
        turnTimes: emptyHistogram(SITE_TURN_TIME_LIMITS_SECONDS),
        publicFillTimes: emptyHistogram(SITE_FILL_TIME_LIMITS_SECONDS),
        gameLengths: emptyHistogram(SITE_GAME_LENGTH_LIMITS_DAYS),
        titles: {}
    }
}

function setup(latest?: UtcDay, earliestGame?: Date) {
    const createPushTask = vi.fn(async (_options: CreatePushTaskOptions<unknown>) => undefined)
    const service = new SiteStatsService(
        {
            games: {
                findGamesWithTimestampIn: async () => [],
                findGamesInPlayDuring: async () => [],
                findPlayActionsDuring: async () => ({ actions: [], includesFirstAction: true }),
                findEarliestGameCreatedAt: async () => earliestGame,
                countGamesWithStatus: async () => 0,
                countStartedGamesQuietSince: async () => 0
            },
            users: { countUsersCreatedIn: async () => 0, countUsersWithStatus: async () => 0 },
            subscriptions: { countSubscriptionsWithTransport: async () => 0 }
        },
        {
            saveDay: async () => undefined,
            findMonths: async () => [],
            findRolledDays: async () => ({
                first: latest && '2026-01-01',
                latest: latest ? rolledDay(latest) : undefined
            })
        },
        { createPushTask },
        { cachingGet: async () => undefined },
        () => new Date('2026-10-18T00:10:00Z')
    )
    const firstTask = () => createPushTask.mock.calls[0]?.[0].payload
    return { service, firstTask, createPushTask }
}

describe('site stats rollup runs', () => {
    it('re-rolls the two settling days when the rollup is up to date', async () => {
        const { service, firstTask } = setup('2026-10-17')
        await service.startDailyRollup()
        expect(firstTask()).toMatchObject({ day: '2026-10-15', through: '2026-10-17' })
    })

    it('catches up from the first day missed', async () => {
        const { service, firstTask } = setup('2026-10-09')
        await service.startDailyRollup()
        expect(firstTask()).toMatchObject({ day: '2026-10-10', through: '2026-10-17' })
    })

    it('names each step of a chain so a retried step cannot fork it', async () => {
        const { service, createPushTask } = setup('2026-10-17')
        await service.startDailyRollup()
        expect(createPushTask.mock.calls[0]?.[0].uniqueName).toMatch(/^site-stats-.+-2026-10-15$/)
    })

    it('starts a rebuild at the first game', async () => {
        const { service, firstTask } = setup(undefined, new Date('2024-08-03T12:00:00Z'))
        await service.startRollup({})
        expect(firstTask()).toMatchObject({ day: '2024-08-03', through: '2026-10-17' })
    })

    it('refuses to roll up today or a range that runs backwards', async () => {
        const { service } = setup()
        await expect(service.startRollup({ from: '2026-10-01', to: '2026-10-18' })).rejects.toThrow(
            InvalidSiteStatsRangeError
        )
        await expect(service.startRollup({ from: '2026-10-05', to: '2026-10-01' })).rejects.toThrow(
            InvalidSiteStatsRangeError
        )
    })

    it.each([
        ['impossible', { from: '2026-02-30', to: '2026-03-01' }],
        ['too long', { from: '2024-01-01', to: '2026-10-17' }],
        ['unfinished', { from: '2026-10-01', to: '2026-10-18' }]
    ])('refuses a report over an %s range', async (_, range) => {
        const { service } = setup()
        await expect(service.getReport(range)).rejects.toThrow(InvalidSiteStatsRangeError)
    })
})
