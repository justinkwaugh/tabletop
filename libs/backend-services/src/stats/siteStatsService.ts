import {
    addUtcDays,
    GameStatus,
    MILLISECONDS_PER_DAY,
    UserStatus,
    UtcDay,
    utcDayOf,
    utcDayStart,
    type SiteStatsDay,
    type SiteStatsNow,
    type SiteStatsRange
} from '@tabletop/common'
import { nanoid } from 'nanoid'
import { Type, type Static } from 'typebox'
import type {
    SiteStatsGameSource,
    SiteStatsStore,
    SiteStatsUserSource
} from '../persistence/stores/siteStatsStore.js'
import type { TaskService } from '../tasks/taskService.js'
import {
    distinctUsers,
    EARLIER_ACTIVE_USER_DAYS,
    summarizeSiteDay,
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

export class SiteStatsService {
    constructor(
        private readonly games: SiteStatsGameSource,
        private readonly users: SiteStatsUserSource,
        private readonly store: SiteStatsStore,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly now: () => Date = () => new Date()
    ) {}

    yesterday(): UtcDay {
        return addUtcDays(utcDayOf(this.now()), -1)
    }

    async startRollup(from: UtcDay | undefined, through: UtcDay): Promise<string> {
        const firstDay = from ?? (await this.earliestGameDay())
        const runId = nanoid()
        this.report(runId, 'start', { from: firstDay, through })
        await this.enqueue({ runId, day: firstDay, through })
        return runId
    }

    async startDailyRollup(): Promise<string> {
        const yesterday = this.yesterday()
        const settled = addUtcDays(yesterday, -SETTLING_DAYS)
        const latest = await this.store.findLatestDay()
        const firstMissing = latest === undefined ? settled : addUtcDays(latest, 1)
        return this.startRollup(firstMissing < settled ? firstMissing : settled, yesterday)
    }

    async runRollupTask(task: SiteStatsRollupTask): Promise<void> {
        const started = Date.now()
        const stats = await this.rollupDay(task.day)
        this.report(task.runId, 'day', {
            day: task.day,
            userActions: stats.userActions,
            activeUsers: stats.activeUsers,
            durationMs: Date.now() - started
        })
        if (task.day < task.through) await this.enqueue({ ...task, day: addUtcDays(task.day, 1) })
        else this.report(task.runId, 'complete', { through: task.through })
    }

    async rollupDay(day: UtcDay): Promise<SiteStatsDay> {
        const start = utcDayStart(day)
        const end = new Date(start.getTime() + MILLISECONDS_PER_DAY)
        const [newUsers, createdGames, startedGames, finishedGames, gamesInPlay, earlier] =
            await Promise.all([
                this.users.countUsersCreatedBetween(start, end),
                this.games.findGamesWithTimestampBetween('createdAt', start, end),
                this.games.findGamesWithTimestampBetween('startedAt', start, end),
                this.games.findGamesWithTimestampBetween('finishedAt', start, end),
                this.games.findGamesInPlayBetween(start, end),
                this.store.findActiveUsers(
                    addUtcDays(day, -EARLIER_ACTIVE_USER_DAYS),
                    addUtcDays(day, -1)
                )
            ])
        const plays: SiteDayPlay[] = []
        for (let index = 0; index < gamesInPlay.length; index += PLAY_READ_BATCH) {
            const batch = gamesInPlay.slice(index, index + PLAY_READ_BATCH)
            const found = await Promise.all(
                batch.map((game) => this.games.findPlayActionsBetween(game, start, end))
            )
            batch.forEach((game, offset) => plays.push({ game, ...found[offset] }))
        }
        const rollup = summarizeSiteDay(
            {
                day,
                newUsers,
                createdGames,
                startedGames,
                finishedGames: finishedGames.filter((game) => game.status === GameStatus.Finished),
                plays,
                earlierActiveUsers: earlier
            },
            this.now().getTime()
        )
        await this.store.saveDay(rollup)
        return rollup.stats
    }

    async getRange(from: UtcDay, to: UtcDay): Promise<SiteStatsRange> {
        const [days, activeUsers, rolledThrough] = await Promise.all([
            this.store.findDays(from, to),
            this.store.findActiveUsers(from, to),
            this.store.findLatestDay()
        ])
        const titleIds = new Set(days.flatMap((day) => Object.keys(day.titles)))
        return {
            from,
            to,
            rolledThrough,
            days,
            activeUsers: distinctUsers(activeUsers),
            titleActiveUsers: Object.fromEntries(
                [...titleIds].map((titleId) => [titleId, distinctUsers(activeUsers, titleId)])
            )
        }
    }

    async getNow(): Promise<SiteStatsNow> {
        const now = this.now()
        const quietSince = (days: number) =>
            this.games.countStartedGamesQuietSince(
                new Date(now.getTime() - days * MILLISECONDS_PER_DAY)
            )
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
            quietFor30Days
        ] = await Promise.all([
            this.users.countUsersWithStatus(UserStatus.Active),
            this.users.countUsersWithStatus(UserStatus.Incomplete),
            this.users.countUsersWithStatus(UserStatus.Inactive),
            this.users.countUsersWithStatus(UserStatus.Deleted),
            this.games.countGamesWithStatus(GameStatus.WaitingForPlayers),
            this.games.countGamesWithStatus(GameStatus.WaitingToStart),
            this.games.countGamesWithStatus(GameStatus.Started),
            this.games.countGamesWithStatus(GameStatus.Finished),
            quietSince(7),
            quietSince(30)
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
            }
        }
    }

    private async earliestGameDay(): Promise<UtcDay> {
        const earliest = await this.games.findEarliestGameCreatedAt()
        return earliest ? utcDayOf(earliest) : this.yesterday()
    }

    private async enqueue(payload: SiteStatsRollupTask): Promise<void> {
        await this.tasks.createPushTask({ queue: 'maintenance', path: '/stats/rollup', payload })
    }

    private report(runId: string, event: string, detail: object): void {
        console.log(`Site stats rollup ${JSON.stringify({ runId, event, ...detail })}`)
    }
}
