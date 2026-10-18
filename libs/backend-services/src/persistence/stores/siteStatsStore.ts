import type {
    Game,
    GameAction,
    GameStatus,
    SiteStatsDay,
    TimeWindow,
    UserStatus,
    UtcDay,
    UtcDayRange
} from '@tabletop/common'
import type { ActiveUserSketches, SiteStatsMonth } from '../model/storedSiteStatsMonth.js'
import type { TransportType } from '../../notifications/transports/notificationTransport.js'

export type GameTimestampField = 'createdAt' | 'startedAt' | 'finishedAt'

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
    countSubscriptionsWithTransport(transport: TransportType): Promise<number>
}

export type RolledDays = { first?: UtcDay; latest?: SiteStatsDay }

export interface SiteStatsStore {
    saveDay(stats: SiteStatsDay, activeUsers: ActiveUserSketches): Promise<void>
    findMonths(range: UtcDayRange): Promise<SiteStatsMonth[]>
    findRolledDays(): Promise<RolledDays>
}
