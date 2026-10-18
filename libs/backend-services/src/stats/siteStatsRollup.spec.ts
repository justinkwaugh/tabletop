import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameCategory,
    GameResult,
    histogramBucket,
    PlayerStatus,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    type GameAction
} from '@tabletop/common'
import {
    summarizeSiteDay,
    type SiteDayActiveUsers,
    type SiteDayGame,
    type SiteDaySource
} from './siteStatsRollup.js'

const DAY = '2026-10-17'
const at = (time: string) => new Date(`${DAY}T${time}Z`)
const before = (time: string) => new Date(`2026-10-16T${time}Z`)

function game(id: string, overrides: Partial<SiteDayGame> = {}): SiteDayGame {
    return {
        id,
        typeId: 'sol',
        hotseat: false,
        startedAt: before('09:00:00'),
        players: ['a', 'b', 'bot'].map((playerId) => ({
            id: playerId,
            userId: playerId === 'bot' ? undefined : `user-${playerId}`,
            name: playerId,
            isHuman: playerId !== 'bot',
            status: PlayerStatus.Joined
        })),
        ...overrides
    }
}

let nextIndex = 0
function action(playerId: string, createdAt: Date, source = ActionSource.User): GameAction {
    nextIndex += 1
    return {
        id: `action-${nextIndex}`,
        gameId: 'game',
        source,
        type: 'move',
        playerId,
        index: nextIndex,
        createdAt
    }
}

function source(overrides: Partial<SiteDaySource> = {}): SiteDaySource {
    return {
        day: DAY,
        newUsers: 0,
        createdGames: [],
        startedGames: [],
        finishedGames: [],
        plays: [],
        earlierActiveUsers: [],
        ...overrides
    }
}

function turnBucket(seconds: number) {
    return histogramBucket(SITE_TURN_TIME_LIMITS_SECONDS, seconds)
}

describe('site day rollup', () => {
    it('counts lifecycle events for counted games only, per title', () => {
        const { stats } = summarizeSiteDay(
            source({
                newUsers: 3,
                createdGames: [
                    game('g1'),
                    game('g2', { typeId: 'kaivai' }),
                    game('hotseat', { hotseat: true }),
                    game('fork', { parentId: 'g1' }),
                    game('explore', { category: GameCategory.Exploration })
                ],
                startedGames: [game('g1')],
                finishedGames: [
                    game('g3', { result: GameResult.Win, finishedAt: at('12:00:00') }),
                    game('g4', { result: GameResult.Abandoned, finishedAt: at('12:00:00') })
                ]
            }),
            1
        )
        expect(stats.newUsers).toBe(3)
        expect(stats.games).toEqual({ created: 2, started: 1, finished: 1, abandoned: 1 })
        expect(stats.titles['sol'].games).toEqual({
            created: 1,
            started: 1,
            finished: 1,
            abandoned: 1
        })
        expect(stats.titles['kaivai'].games.created).toBe(1)
        expect(stats.gameLengths[histogramBucket(SITE_GAME_LENGTH_LIMITS_DAYS, 1.125)]).toBe(1)
    })

    it('counts human user actions in the day and times turns from the previous player', () => {
        const actions = [
            action('a', before('23:00:00')),
            action('b', at('00:30:00')),
            action('b', at('00:31:00')),
            action('bot', at('00:32:00')),
            action('a', at('02:31:00'), ActionSource.System),
            action('a', at('04:31:00')),
            action('b', new Date('2026-10-18T00:00:00Z'))
        ]
        const { stats, activeUsers } = summarizeSiteDay(
            source({ plays: [{ game: game('g1'), actions, includesFirstAction: false }] }),
            1
        )
        expect(stats.userActions).toBe(3)
        expect(stats.activeUsers).toBe(2)
        expect(activeUsers.users).toEqual(['user-a', 'user-b'])
        const turns = stats.turnTimes
        expect(turns.reduce((total, count) => total + count, 0)).toBe(2)
        expect(turns[turnBucket(90 * 60)]).toBe(1)
        expect(turns[turnBucket(4 * 60 * 60)]).toBe(1)
        expect(stats.titles['sol']).toMatchObject({ userActions: 3, activeUsers: 2 })
    })

    it('times the first turn from the start only when the history is complete', () => {
        const first = [action('a', at('10:00:00'))]
        const timed = summarizeSiteDay(
            source({
                plays: [
                    { game: game('g1', { startedAt: at('09:00:00') }), actions: first, includesFirstAction: true }
                ]
            }),
            1
        )
        expect(timed.stats.turnTimes[turnBucket(3600)]).toBe(1)
        const untimed = summarizeSiteDay(
            source({ plays: [{ game: game('g1'), actions: first, includesFirstAction: false }] }),
            1
        )
        expect(untimed.stats.turnTimes.every((count) => count === 0)).toBe(true)
    })

    it('ignores play in hotseat games', () => {
        const { stats } = summarizeSiteDay(
            source({
                plays: [
                    {
                        game: game('g1', { hotseat: true }),
                        actions: [action('a', at('10:00:00'))],
                        includesFirstAction: true
                    }
                ]
            }),
            1
        )
        expect(stats.userActions).toBe(0)
    })

    it('counts distinct users over the trailing 7 and 28 days', () => {
        const earlier = (day: string, users: string[]): SiteDayActiveUsers => ({
            day,
            users,
            titles: {}
        })
        const { stats } = summarizeSiteDay(
            source({
                plays: [
                    {
                        game: game('g1'),
                        actions: [action('a', at('10:00:00'))],
                        includesFirstAction: false
                    }
                ],
                earlierActiveUsers: [
                    earlier('2026-10-11', ['user-a', 'user-c']),
                    earlier('2026-10-10', ['user-d']),
                    earlier('2026-09-20', ['user-e']),
                    earlier('2026-09-19', ['user-f'])
                ]
            }),
            1
        )
        expect(stats).toMatchObject({ activeUsers: 1, activeUsers7d: 2, activeUsers28d: 4 })
    })
})
