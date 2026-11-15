import {
    addUtcDays,
    assertExists,
    BaseError,
    GameStatus,
    isCountedGame,
    MILLISECONDS_PER_DAY,
    previousUtcRange,
    SiteStatsNow,
    UserStatus,
    UtcDay,
    utcDayOf,
    utcDayWindow,
    utcRangeProblem,
    type Game,
    type SiteStatsDay,
    type SiteStatsRange,
    type SiteStatsReport,
    type TimeWindow,
    type UtcDayRange
} from '@tabletop/common'
import { nanoid } from 'nanoid'
import { Type, type Static } from 'typebox'
import * as Value from 'typebox/value'
import type { RedisCacheService } from '../cache/cacheService.js'
import type { SiteStatsMonth } from '../persistence/model/storedSiteStatsMonth.js'
import type {
    SiteStatsGameSource,
    SiteStatsStore,
    SiteStatsSubscriptionSource,
    SiteStatsUserSource
} from '../persistence/stores/siteStatsStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { TransportType } from '../notifications/transports/notificationTransport.js'
import { countDistinct } from './hyperLogLog.js'
import {
    EARLIER_ACTIVE_USER_DAYS,
    summarizeSiteDay,
    type EarlierActiveUsers,
    type SiteDayPlay
} from './siteStatsRollup.js'

export const SiteStatsRollupTask = Type.Object(
    {
        runId: Type.String({ minLength: 1 }),
        day: UtcDay,
        through: UtcDay
    },
    { additionalProperties: false }
)
export type SiteStatsRollupTask = Static<typeof SiteStatsRollupTask>

export const SETTLING_DAYS = 2
const PLAY_READ_BATCH = 10
const NOW_CACHE_KEY = 'site-stats-now'
const NOW_CACHE_SECONDS = 10 * 60

type RolledDay = EarlierActiveUsers & { stats: SiteStatsDay }

export type SiteStatsSources = {
    games: SiteStatsGameSource
    users: SiteStatsUserSource
    subscriptions: SiteStatsSubscriptionSource
}

export class InvalidSiteStatsRangeError extends BaseError {
    constructor(message: string) {
        super({ name: 'InvalidSiteStatsRange', message })
    }
}

export class SiteStatsService {
    constructor(
        private readonly sources: SiteStatsSources,
        private readonly store: SiteStatsStore,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly cache: Pick<RedisCacheService, 'cachingGet'>,
        private readonly now: () => Date = () => new Date()
    ) {}

    yesterday(): UtcDay {
        return addUtcDays(utcDayOf(this.now()), -1)
    }

    async startRollup(requested: Partial<UtcDayRange>): Promise<string> {
        const range = {
            from: requested.from ?? (await this.earliestGameDay()),
            to: requested.to ?? this.yesterday()
        }
        const problem = utcRangeProblem(range, this.yesterday(), Infinity)
        if (problem) throw new InvalidSiteStatsRangeError(problem)
        const runId = nanoid()
        this.report(runId, 'start', range)
        await this.enqueue({ runId, day: range.from, through: range.to })
        return runId
    }

    async startDailyRollup(): Promise<string> {
        const yesterday = this.yesterday()
        const settled = addUtcDays(yesterday, -SETTLING_DAYS)
        const { latest } = await this.store.findRolledDays()
        const firstMissing = latest === undefined ? settled : addUtcDays(latest.day, 1)
        return this.startRollup({
            from: firstMissing < settled ? firstMissing : settled,
            to: yesterday
        })
    }

    async runRollupTask(task: SiteStatsRollupTask): Promise<void> {
        const stats = await this.rollupDay(task.day)
        this.report(task.runId, 'day', {
            day: task.day,
            userActions: stats.userActions,
            activeUsers: stats.activeUsers,
            ...stats.rollup
        })
        if (task.day < task.through) await this.enqueue({ ...task, day: addUtcDays(task.day, 1) })
        else this.report(task.runId, 'complete', { through: task.through })
    }

    async rollupDay(day: UtcDay): Promise<SiteStatsDay> {
        const startedAt = this.now().getTime()
        const window = utcDayWindow(day)
        const earlierRange = {
            from: addUtcDays(day, -EARLIER_ACTIVE_USER_DAYS),
            to: addUtcDays(day, -1)
        }
        const { games, users } = this.sources
        const [newUsers, createdGames, startedGames, finishedGames, gamesInPlay, earlierMonths] =
            await Promise.all([
                users.countUsersActivatedIn(window),
                games.findGamesWithTimestampIn('createdAt', window),
                games.findGamesWithTimestampIn('startedAt', window),
                games.findGamesWithTimestampIn('finishedAt', window),
                games.findGamesInPlayDuring(window),
                this.store.findMonths(earlierRange)
            ])
        const plays = await this.readPlays(gamesInPlay.filter(isCountedGame), window)
        const computedAt = this.now().getTime()
        const { stats, activeUsers } = summarizeSiteDay(
            {
                day,
                newUsers,
                createdGames,
                startedGames,
                finishedGames: finishedGames.filter((game) => game.status === GameStatus.Finished),
                plays,
                earlierActiveUsers: this.rolledDaysIn(earlierMonths, earlierRange)
            },
            computedAt
        )
        const saved = {
            ...stats,
            rollup: { gamesInPlay: plays.length, durationMs: computedAt - startedAt }
        }
        await this.store.saveDay(saved, activeUsers)
        return saved
    }

    async getReport(range: UtcDayRange): Promise<SiteStatsReport> {
        const problem = utcRangeProblem(range, this.yesterday())
        if (problem) throw new InvalidSiteStatsRangeError(problem)
        const previous = previousUtcRange(range)
        const [months, rolled] = await Promise.all([
            this.store.findMonths({ from: previous.from, to: range.to }),
            this.store.findRolledDays()
        ])
        return {
            rolledFrom: rolled.first,
            latest: rolled.latest,
            current: this.summarizeRange(range, this.rolledDaysIn(months, range)),
            previous: this.summarizeRange(previous, this.rolledDaysIn(months, previous))
        }
    }

    async getNow(): Promise<SiteStatsNow> {
        const now = await this.cache.cachingGet<unknown>(
            NOW_CACHE_KEY,
            () => this.countNow(),
            NOW_CACHE_SECONDS
        )
        Value.Assert(SiteStatsNow, now)
        return now
    }

    private async countNow(): Promise<SiteStatsNow> {
        const now = this.now()
        const { games, users, subscriptions } = this.sources
        const quietSince = (days: number) =>
            games.countStartedGamesQuietSince(new Date(now.getTime() - days * MILLISECONDS_PER_DAY))
        const [
            active,
            incomplete,
            inactive,
            deleted,
            waitingForPlayers,
            waitingToStart,
            started,
            finished,
            quietFor7Days,
            quietFor30Days,
            webPush,
            discord
        ] = await Promise.all([
            users.countUsersWithStatus(UserStatus.Active),
            users.countUsersWithStatus(UserStatus.Incomplete),
            users.countUsersWithStatus(UserStatus.Inactive),
            users.countUsersWithStatus(UserStatus.Deleted),
            games.countGamesWithStatus(GameStatus.WaitingForPlayers),
            games.countGamesWithStatus(GameStatus.WaitingToStart),
            games.countGamesWithStatus(GameStatus.Started),
            games.countGamesWithStatus(GameStatus.Finished),
            quietSince(7),
            quietSince(30),
            subscriptions.countSubscriptionsWithTransport(TransportType.WebPush),
            subscriptions.countSubscriptionsWithTransport(TransportType.Discord)
        ])
        return {
            asOf: now.getTime(),
            users: { active, incomplete, inactive, deleted },
            games: {
                waitingForPlayers,
                waitingToStart,
                started,
                finished,
                quietFor7Days,
                quietFor30Days
            },
            notificationClients: { webPush, discord }
        }
    }

    private async readPlays(games: Game[], window: TimeWindow): Promise<SiteDayPlay[]> {
        const plays: SiteDayPlay[] = []
        for (let index = 0; index < games.length; index += PLAY_READ_BATCH) {
            const batch = games.slice(index, index + PLAY_READ_BATCH)
            const playActions = await Promise.all(
                batch.map((game) => this.sources.games.findPlayActionsDuring(game, window))
            )
            batch.forEach((game, offset) => plays.push({ game, ...playActions[offset] }))
        }
        return plays
    }

    private rolledDaysIn(months: readonly SiteStatsMonth[], range: UtcDayRange): RolledDay[] {
        return months
            .flatMap((month) =>
                Object.entries(month.days).map(([day, stats]) => {
                    const activeUsers = month.activeUsers[day]
                    assertExists(activeUsers, `Rolled-up day ${day} has no active users`)
                    return { day, stats, activeUsers }
                })
            )
            .filter(({ day }) => day >= range.from && day <= range.to)
            .sort((a, b) => a.day.localeCompare(b.day))
    }

    private summarizeRange(range: UtcDayRange, days: readonly RolledDay[]): SiteStatsRange {
        const sketches = days.map((day) => day.activeUsers)
        const titleIds = new Set(days.flatMap((day) => Object.keys(day.stats.titles)))
        return {
            ...range,
            days: days.map((day) => day.stats),
            activeUsers: countDistinct(sketches.map((sketch) => sketch.users)),
            titleActiveUsers: Object.fromEntries(
                [...titleIds].map((titleId) => [
                    titleId,
                    countDistinct(sketches.flatMap((sketch) => sketch.titles[titleId] ?? []))
                ])
            )
        }
    }

    private async earliestGameDay(): Promise<UtcDay> {
        const earliest = await this.sources.games.findEarliestGameCreatedAt()
        assertExists(earliest, 'A rebuild needs at least one game')
        return utcDayOf(earliest)
    }

    private async enqueue(payload: SiteStatsRollupTask): Promise<void> {
        await this.tasks.createPushTask({
            queue: 'maintenance',
            path: '/stats/rollup',
            payload,
            uniqueName: `site-stats-${payload.runId}-${payload.day}`
        })
    }

    private report(runId: string, event: string, detail: object): void {
        console.log(`Site stats rollup ${JSON.stringify({ runId, event, ...detail })}`)
    }
}
