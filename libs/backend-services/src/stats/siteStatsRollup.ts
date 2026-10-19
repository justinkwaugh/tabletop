import {
    ActionSource,
    addToHistogram,
    addUtcDays,
    emptyHistogram,
    GameCategory,
    GameResult,
    isCountedGame,
    isListedPublicGame,
    MILLISECONDS_PER_DAY,
    SITE_FILL_TIME_LIMITS_SECONDS,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    utcDayWindow,
    type Game,
    type GameAction,
    type SiteGameCounts,
    type SiteStatsDay,
    type SiteTitleDay,
    type TimeWindow,
    type UtcDay
} from '@tabletop/common'
import type { ActiveUserSketches } from '../persistence/model/storedSiteStatsMonth.js'
import type { PlayActions } from '../persistence/stores/siteStatsStore.js'
import { countDistinct, sketchOf } from './hyperLogLog.js'

export type SiteDayGame = Pick<
    Game,
    | 'id'
    | 'typeId'
    | 'players'
    | 'hotseat'
    | 'parentId'
    | 'category'
    | 'isPublic'
    | 'unlisted'
    | 'result'
    | 'createdAt'
    | 'startedAt'
    | 'finishedAt'
>

export type SiteDayPlay = PlayActions & { game: SiteDayGame }

export type EarlierActiveUsers = { day: UtcDay; activeUsers: ActiveUserSketches }

export type SiteDaySource = {
    day: UtcDay
    newUsers: number
    createdGames: SiteDayGame[]
    startedGames: SiteDayGame[]
    finishedGames: SiteDayGame[]
    plays: SiteDayPlay[]
    earlierActiveUsers: EarlierActiveUsers[]
}

export type SiteDayRollup = {
    stats: Omit<SiteStatsDay, 'rollup'>
    activeUsers: ActiveUserSketches
}

export const EARLIER_ACTIVE_USER_DAYS = 27

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

class SiteDayTally {
    readonly site = new TitleTally()
    readonly titles = new Map<string, TitleTally>()
    readonly uncountedGamesCreated = { hotseat: 0, forks: 0, explorations: 0 }
    readonly publicFillTimes = emptyHistogram(SITE_FILL_TIME_LIMITS_SECONDS)
    readonly gameLengths = emptyHistogram(SITE_GAME_LENGTH_LIMITS_DAYS)
    automaticActions = 0

    constructor(private readonly window: TimeWindow) {}

    siteAndTitle(game: SiteDayGame): TitleTally[] {
        let title = this.titles.get(game.typeId)
        if (!title) {
            title = new TitleTally()
            this.titles.set(game.typeId, title)
        }
        return [this.site, title]
    }

    created(game: SiteDayGame) {
        if (isCountedGame(game))
            for (const tally of this.siteAndTitle(game)) tally.games.created += 1
        else if (game.hotseat) this.uncountedGamesCreated.hotseat += 1
        else if (game.parentId !== undefined) this.uncountedGamesCreated.forks += 1
        else if (game.category === GameCategory.Exploration)
            this.uncountedGamesCreated.explorations += 1
    }

    started(game: SiteDayGame) {
        for (const tally of this.siteAndTitle(game)) tally.games.started += 1
        if (isListedPublicGame(game) && game.createdAt && game.startedAt)
            addToHistogram(
                this.publicFillTimes,
                SITE_FILL_TIME_LIMITS_SECONDS,
                (game.startedAt.getTime() - game.createdAt.getTime()) / 1000
            )
    }

    finished(game: SiteDayGame) {
        const abandoned = game.result === GameResult.Abandoned
        for (const tally of this.siteAndTitle(game))
            if (abandoned) tally.games.abandoned += 1
            else tally.games.finished += 1
        if (!abandoned && game.startedAt && game.finishedAt)
            addToHistogram(
                this.gameLengths,
                SITE_GAME_LENGTH_LIMITS_DAYS,
                (game.finishedAt.getTime() - game.startedAt.getTime()) / MILLISECONDS_PER_DAY
            )
    }

    played(play: SiteDayPlay) {
        const tallies = this.siteAndTitle(play.game)
        let previousTurn: GameAction | undefined
        for (const action of play.actions) {
            const at = this.timeDuring(action)
            const userId = this.humanUserId(play.game, action)
            if (at !== undefined && userId === undefined) this.automaticActions += 1
            if (action.source === ActionSource.System) continue
            if (at !== undefined && userId !== undefined) {
                const turnStartedAt = this.turnStart(play, previousTurn, action)
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
            previousTurn = action
        }
    }

    private turnStart(
        play: SiteDayPlay,
        previousTurn: GameAction | undefined,
        action: GameAction
    ): number | undefined {
        if (!previousTurn)
            return play.includesFirstAction ? play.game.startedAt?.getTime() : undefined
        if (previousTurn.playerId === action.playerId) return undefined
        return previousTurn.createdAt?.getTime()
    }

    private humanUserId(game: SiteDayGame, action: GameAction): string | undefined {
        if (action.source === ActionSource.System) return undefined
        const player = game.players.find((candidate) => candidate.id === action.playerId)
        return player?.isHuman ? player.userId : undefined
    }

    private timeDuring(action: GameAction): number | undefined {
        const at = action.createdAt
        return at && at >= this.window.start && at < this.window.end ? at.getTime() : undefined
    }
}

export function summarizeSiteDay(source: SiteDaySource, computedAt: number): SiteDayRollup {
    const tally = new SiteDayTally(utcDayWindow(source.day))
    for (const game of source.createdGames) tally.created(game)
    for (const game of source.startedGames.filter(isCountedGame)) tally.started(game)
    for (const game of source.finishedGames.filter(isCountedGame)) tally.finished(game)
    for (const play of source.plays.filter((play) => isCountedGame(play.game))) tally.played(play)

    const activeUsers: ActiveUserSketches = {
        users: sketchOf(tally.site.users),
        titles: Object.fromEntries(
            [...tally.titles]
                .filter(([, title]) => title.users.size > 0)
                .map(([titleId, title]) => [titleId, sketchOf(title.users)])
        )
    }
    const trailing = (days: number) => {
        const first = addUtcDays(source.day, 1 - days)
        return countDistinct([
            activeUsers.users,
            ...source.earlierActiveUsers
                .filter((earlier) => earlier.day >= first)
                .map((earlier) => earlier.activeUsers.users)
        ])
    }
    return {
        activeUsers,
        stats: {
            day: source.day,
            computedAt,
            newUsers: source.newUsers,
            games: tally.site.games,
            uncountedGamesCreated: tally.uncountedGamesCreated,
            userActions: tally.site.userActions,
            automaticActions: tally.automaticActions,
            activeUsers: tally.site.users.size,
            activeUsers7d: trailing(7),
            activeUsers28d: trailing(28),
            turnTimes: tally.site.turnTimes,
            publicFillTimes: tally.publicFillTimes,
            gameLengths: tally.gameLengths,
            titles: Object.fromEntries(
                [...tally.titles].map(([titleId, title]) => [titleId, title.summary()])
            )
        }
    }
}
