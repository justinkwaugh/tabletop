import type {
    Game,
    GameAction,
    GameStatus,
    SiteStatsDay,
    UserStatus,
    UtcDayRange
} from '@tabletop/common'
import type { ActiveUserSketches, StoredSiteStatsMonth } from '../model/storedSiteStatsMonth.js'

export type GameTimestampField = 'createdAt' | 'startedAt' | 'finishedAt'

export type TimeWindow = { start: Date; end: Date }

export type PlayActions = {
    actions: GameAction[]
    includesFirstAction: boolean
}

export interface SiteStatsGameSource {
    findGamesWithTimestampIn(field: GameTimestampField, window: TimeWindow): Promise<Game[]>
    findGamesInPlayDuring(window: TimeWindow): Promise<Game[]>
    findPlayActionsDuring(game: Game, window: TimeWindow): Promise<PlayActions>
    findEarliestGameCreatedAt(): Promise<Date | undefined>
    countGamesWithStatus(status: GameStatus): Promise<number>
    countStartedGamesQuietSince(lastActionBefore: Date): Promise<number>
}

export interface SiteStatsUserSource {
    countUsersCreatedIn(window: TimeWindow): Promise<number>
    countUsersWithStatus(status: UserStatus): Promise<number>
}

export interface SiteStatsSubscriptionSource {
    countSubscriptionsWithTransport(transport: string): Promise<number>
}

export interface SiteStatsStore {
    saveDay(stats: SiteStatsDay, activeUsers: ActiveUserSketches): Promise<void>
    findMonths(range: UtcDayRange): Promise<StoredSiteStatsMonth[]>
    findRolledDays(): Promise<Partial<UtcDayRange>>
}
