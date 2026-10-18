import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameCategory,
    GameResult,
    histogramBucket,
    histogramTotal,
    PlayerStatus,
    SITE_GAME_LENGTH_LIMITS_DAYS,
    SITE_TURN_TIME_LIMITS_SECONDS,
    type GameAction
} from '@tabletop/common'
import { sketchOf } from './hyperLogLog.js'
import { summarizeSiteDay, type SiteDayGame, type SiteDaySource } from './siteStatsRollup.js'

const DAY = '2026-10-17'
const at = (time: string) => new Date(`${DAY}T${time}Z`)
const before = (time: string) => new Date(`2026-10-16T${time}Z`)

function game(id: string, overrides: Partial<SiteDayGame> = {}): SiteDayGame {
    return {
        id,
        typeId: 'sol',
        hotseat: false,
        isPublic: false,
        createdAt: before('08:00:00'),
        startedAt: before('09:00:00'),
        players: ['a', 'b', 'c', 'bot'].map((playerId) => ({
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

function turnsTaken(actions: GameAction[], includesFirstAction = false) {
    const { stats } = summarizeSiteDay(
        source({ plays: [{ game: game('g1'), actions, includesFirstAction }] }),
        1
    )
    return stats.turnTimes
}

function bucket(seconds: number) {
    return histogramBucket(SITE_TURN_TIME_LIMITS_SECONDS, seconds)
}

describe('site day rollup', () => {
    it('counts lifecycle events for counted games, per title, and the rest on their own', () => {
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
                startedGames: [game('g1', { isPublic: true, startedAt: before('11:00:00') })],
                finishedGames: [
                    game('g3', { result: GameResult.Win, finishedAt: at('12:00:00') }),
                    game('g4', { result: GameResult.Abandoned, finishedAt: at('12:00:00') }),
                    game('hotseat-done', { hotseat: true, finishedAt: at('12:00:00') })
                ]
            }),
            1
        )
        expect(stats.newUsers).toBe(3)
        expect(stats.games).toEqual({ created: 2, started: 1, finished: 1, abandoned: 1 })
        expect(stats.uncountedGamesCreated).toEqual({ hotseat: 1, forks: 1, explorations: 1 })
        expect(stats.titles['sol'].games).toEqual({
            created: 1,
            started: 1,
            finished: 1,
            abandoned: 1
        })
        expect(stats.titles['kaivai'].games.created).toBe(1)
        expect(stats.publicFillTimes[bucket(3 * 3600)]).toBe(1)
        expect(stats.gameLengths[histogramBucket(SITE_GAME_LENGTH_LIMITS_DAYS, 1.125)]).toBe(1)
    })

    it('counts human actions in the day, system actions apart, and times turns from the previous player', () => {
        const actions = [
            action('a', before('23:00:00')),
            action('b', at('00:30:00')),
            action('b', at('00:31:00')),
            action('a', at('00:31:00'), ActionSource.System),
            action('a', at('04:31:00')),
            action('b', new Date('2026-10-18T00:00:00Z'))
        ]
        const { stats, activeUsers } = summarizeSiteDay(
            source({ plays: [{ game: game('g1'), actions, includesFirstAction: false }] }),
            1
        )
        expect(stats).toMatchObject({ userActions: 3, systemActions: 1, activeUsers: 2 })
        expect(activeUsers.users).toEqual(sketchOf(['user-a', 'user-b']))
        expect(histogramTotal(stats.turnTimes)).toBe(2)
        expect(stats.turnTimes[bucket(90 * 60)]).toBe(1)
        expect(stats.turnTimes[bucket(4 * 3600)]).toBe(1)
        expect(stats.titles['sol']).toMatchObject({ userActions: 3, activeUsers: 2 })
    })

    it("times a human's turn from a bot's move, without counting the bot", () => {
        const turns = turnsTaken([
            action('a', before('23:00:00')),
            action('bot', at('01:00:00')),
            action('a', at('01:10:00'))
        ])
        expect(histogramTotal(turns)).toBe(1)
        expect(turns[bucket(600)]).toBe(1)
    })

    it('times each simultaneous player from the move before theirs', () => {
        const turns = turnsTaken([
            action('a', at('01:00:00')),
            action('b', at('01:05:00')),
            action('c', at('01:35:00'))
        ])
        expect(turns[bucket(300)]).toBe(1)
        expect(turns[bucket(1800)]).toBe(1)
    })

    it('times the turn after an undo from the move that is left', () => {
        const turns = turnsTaken([action('a', at('01:00:00')), action('b', at('03:00:00'))])
        expect(turns[bucket(7200)]).toBe(1)
    })

    it('times the first turn from the start only when the history is complete', () => {
        const first = [action('a', at('10:00:00'))]
        const timed = summarizeSiteDay(
            source({
                plays: [
                    {
                        game: game('g1', { startedAt: at('09:00:00') }),
                        actions: first,
                        includesFirstAction: true
                    }
                ]
            }),
            1
        )
        expect(timed.stats.turnTimes[bucket(3600)]).toBe(1)
        expect(histogramTotal(turnsTaken(first))).toBe(0)
    })

    it('counts distinct users over the trailing 7 and 28 days', () => {
        const earlier = (day: string, users: string[]) => ({
            day,
            activeUsers: { users: sketchOf(users), titles: {} }
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
