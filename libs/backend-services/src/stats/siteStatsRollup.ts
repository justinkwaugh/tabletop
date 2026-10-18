import {
    ActionSource,
    addToHistogram,
    emptyHistogram,
    GameResult,
    isCountedGame,
    MILLISECONDS_PER_DAY,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    utcDayStart,
    type Game,
    type GameAction,
    type SiteGameCounts,
    type SiteStatsDay,
    type SiteTitleDay,
    UtcDay,
    addUtcDays
} from '@tabletop/common'
import * as Type from 'typebox'

export type SiteDayGame = Pick<
    Game,
    | 'id'
    | 'typeId'
    | 'players'
    | 'hotseat'
    | 'parentId'
    | 'category'
    | 'result'
    | 'startedAt'
    | 'finishedAt'
>

export type SiteDayPlay = {
    game: SiteDayGame
    actions: GameAction[]
    includesFirstAction: boolean
}

export const SiteDayActiveUsers = Type.Object({
    day: UtcDay,
    users: Type.Array(Type.String()),
    titles: Type.Record(Type.String(), Type.Array(Type.String()))
})
export type SiteDayActiveUsers = Type.Static<typeof SiteDayActiveUsers>

export type SiteDaySource = {
    day: UtcDay
    newUsers: number
    createdGames: SiteDayGame[]
    startedGames: SiteDayGame[]
    finishedGames: SiteDayGame[]
    plays: SiteDayPlay[]
    earlierActiveUsers: SiteDayActiveUsers[]
}

export type SiteDayRollup = {
    stats: SiteStatsDay
    activeUsers: SiteDayActiveUsers
}

export const EARLIER_ACTIVE_USER_DAYS = 27

type DayWindow = { start: number; end: number }

class TitleTally {
    readonly games: SiteGameCounts = { created: 0, started: 0, finished: 0, abandoned: 0 }
    readonly turnTimes = emptyHistogram(SITE_TURN_TIME_LIMITS_SECONDS)
    readonly users = new Set<string>()
    userActions = 0

    summary(): SiteTitleDay {
        return {
            games: this.games,
            userActions: this.userActions,
            activeUsers: this.users.size,
            turnTimes: this.turnTimes
        }
    }
}

export function summarizeSiteDay(source: SiteDaySource, computedAt: number): SiteDayRollup {
    const start = utcDayStart(source.day).getTime()
    const window = { start, end: start + MILLISECONDS_PER_DAY }
    const site = new TitleTally()
    const titles = new Map<string, TitleTally>()
    const tallies = (game: SiteDayGame) => {
        let title = titles.get(game.typeId)
        if (!title) {
            title = new TitleTally()
            titles.set(game.typeId, title)
        }
        return [site, title]
    }
    const gameLengths = emptyHistogram(SITE_GAME_LENGTH_LIMITS_DAYS)

    for (const game of source.createdGames.filter(isCountedGame))
        for (const tally of tallies(game)) tally.games.created += 1
    for (const game of source.startedGames.filter(isCountedGame))
        for (const tally of tallies(game)) tally.games.started += 1
    for (const game of source.finishedGames.filter(isCountedGame)) {
        const abandoned = game.result === GameResult.Abandoned
        for (const tally of tallies(game))
            if (abandoned) tally.games.abandoned += 1
            else tally.games.finished += 1
        if (!abandoned && game.startedAt && game.finishedAt)
            addToHistogram(
                gameLengths,
                SITE_GAME_LENGTH_LIMITS_DAYS,
                (game.finishedAt.getTime() - game.startedAt.getTime()) / MILLISECONDS_PER_DAY
            )
    }
    for (const play of source.plays.filter((play) => isCountedGame(play.game)))
        tallyPlay(play, window, tallies(play.game))

    const activeUsers: SiteDayActiveUsers = {
        day: source.day,
        users: [...site.users].sort(),
        titles: Object.fromEntries(
            [...titles].map(([titleId, title]) => [titleId, [...title.users].sort()])
        )
    }
    return {
        activeUsers,
        stats: {
            day: source.day,
            computedAt,
            newUsers: source.newUsers,
            games: site.games,
            userActions: site.userActions,
            activeUsers: site.users.size,
            activeUsers7d: distinctUsers([activeUsers, ...within(source, 7)]),
            activeUsers28d: distinctUsers([activeUsers, ...within(source, 28)]),
            turnTimes: site.turnTimes,
            gameLengths,
            titles: Object.fromEntries(
                [...titles].map(([titleId, title]) => [titleId, title.summary()])
            )
        }
    }
}

export function distinctUsers(days: readonly SiteDayActiveUsers[], titleId?: string): number {
    const users = new Set<string>()
    for (const day of days)
        for (const userId of titleId === undefined ? day.users : (day.titles[titleId] ?? []))
            users.add(userId)
    return users.size
}

function within(source: SiteDaySource, days: number): SiteDayActiveUsers[] {
    const first = addUtcDays(source.day, 1 - days)
    return source.earlierActiveUsers.filter((earlier) => earlier.day >= first)
}

function tallyPlay(play: SiteDayPlay, window: DayWindow, tallies: TitleTally[]) {
    let previous: GameAction | undefined
    for (const action of play.actions) {
        const userId = humanUserId(play.game, action)
        if (userId === undefined) continue
        const at = action.createdAt?.getTime()
        if (at !== undefined && at >= window.start && at < window.end) {
            const turnStartedAt = turnStart(play, previous, action)
            for (const tally of tallies) {
                tally.userActions += 1
                tally.users.add(userId)
                if (turnStartedAt !== undefined)
                    addToHistogram(
                        tally.turnTimes,
                        SITE_TURN_TIME_LIMITS_SECONDS,
                        Math.max(0, at - turnStartedAt) / 1000
                    )
            }
        }
        previous = action
    }
}

function turnStart(
    play: SiteDayPlay,
    previous: GameAction | undefined,
    action: GameAction
): number | undefined {
    if (!previous) return play.includesFirstAction ? play.game.startedAt?.getTime() : undefined
    if (previous.playerId === action.playerId) return undefined
    return previous.createdAt?.getTime()
}

function humanUserId(game: SiteDayGame, action: GameAction): string | undefined {
    if (action.source !== ActionSource.User) return undefined
    const player = game.players.find((candidate) => candidate.id === action.playerId)
    return player?.isHuman ? player.userId : undefined
}
