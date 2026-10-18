import { describe, expect, it, vi } from 'vitest'
import type { UtcDayRange } from '@tabletop/common'
import type { CreatePushTaskOptions } from '../tasks/taskService.js'
import { InvalidSiteStatsRangeError, SiteStatsService } from './siteStatsService.js'

function setup(rolled: Partial<UtcDayRange>, earliestGame?: Date) {
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
            findRolledDays: async () => rolled
        },
        { createPushTask },
        { cachingGet: async () => undefined },
        () => new Date('2026-10-18T00:10:00Z')
    )
    const firstTask = () => createPushTask.mock.calls[0]?.[0].payload
    return { service, firstTask }
}

describe('site stats rollup runs', () => {
    it('re-rolls the two settling days when the rollup is up to date', async () => {
        const { service, firstTask } = setup({ from: '2026-01-01', to: '2026-10-17' })
        await service.startDailyRollup()
        expect(firstTask()).toMatchObject({ day: '2026-10-15', through: '2026-10-17' })
    })

    it('catches up from the first day missed', async () => {
        const { service, firstTask } = setup({ from: '2026-01-01', to: '2026-10-09' })
        await service.startDailyRollup()
        expect(firstTask()).toMatchObject({ day: '2026-10-10', through: '2026-10-17' })
    })

    it('starts a rebuild at the first game', async () => {
        const { service, firstTask } = setup({}, new Date('2024-08-03T12:00:00Z'))
        await service.startRollup({})
        expect(firstTask()).toMatchObject({ day: '2024-08-03', through: '2026-10-17' })
    })

    it('refuses to roll up today or a range that runs backwards', async () => {
        const { service } = setup({})
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
        const { service } = setup({})
        await expect(service.getReport(range)).rejects.toThrow(InvalidSiteStatsRangeError)
    })
})
