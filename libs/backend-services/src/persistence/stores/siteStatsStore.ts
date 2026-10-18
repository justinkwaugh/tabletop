import type {
    Game,
    GameAction,
    GameStatus,
    SiteStatsDay,
    UserStatus,
    UtcDay
} from '@tabletop/common'
import type { SiteDayActiveUsers, SiteDayRollup } from '../../stats/siteStatsRollup.js'

export type GameTimestampField = 'createdAt' | 'startedAt' | 'finishedAt'

export type PlayActions = {
    actions: GameAction[]
    includesFirstAction: boolean
}

export interface SiteStatsGameSource {
    findGamesWithTimestampBetween(field: GameTimestampField, start: Date, end: Date): Promise<Game[]>
    findGamesInPlayBetween(start: Date, end: Date): Promise<Game[]>
    findPlayActionsBetween(game: Game, start: Date, end: Date): Promise<PlayActions>
    findEarliestGameCreatedAt(): Promise<Date | undefined>
    countGamesWithStatus(status: GameStatus): Promise<number>
    countStartedGamesQuietSince(lastActionBefore: Date): Promise<number>
}

export interface SiteStatsUserSource {
    countUsersCreatedBetween(start: Date, end: Date): Promise<number>
    countUsersWithStatus(status: UserStatus): Promise<number>
}

export interface SiteStatsStore {
    saveDay(rollup: SiteDayRollup): Promise<void>
    findDays(from: UtcDay, to: UtcDay): Promise<SiteStatsDay[]>
    findActiveUsers(from: UtcDay, to: UtcDay): Promise<SiteDayActiveUsers[]>
    findLatestDay(): Promise<UtcDay | undefined>
}
