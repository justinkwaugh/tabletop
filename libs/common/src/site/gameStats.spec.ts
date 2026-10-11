import { describe, expect, it } from 'vitest'
import { GameCategory } from '../game/model/game.js'
import { GameResult } from '../game/model/gameResult.js'
import { PlayerStatus, type Player } from '../game/model/player.js'
import { PlayOutcome, summarizeUserGames, type GameStatsSource } from './gameStats.js'

const DAY = 86_400_000
const START = Date.UTC(2026, 0, 10)

function player(userId: string, name = userId): Player {
    return { id: `player-${userId}`, userId, name, isHuman: true, status: PlayerStatus.Joined }
}

function summarize(games: GameStatsSource[]) {
    return summarizeUserGames(games, 'me')
}

function finished(
    day: number,
    winners: string[],
    overrides: Partial<GameStatsSource> & { users?: string[] } = {}
): GameStatsSource {
    const { users = ['me', 'ann', 'bo'], ...fields } = overrides
    return {
        id: `game-${day}`,
        typeId: 'freshfish',
        players: users.map((userId) => player(userId)),
        hotseat: false,
        result: winners.length > 1 ? GameResult.Draw : GameResult.Win,
        winningPlayerIds: winners.map((userId) => `player-${userId}`),
        startedAt: new Date(START + (day - 2) * DAY),
        finishedAt: new Date(START + day * DAY),
        ...fields
    }
}

describe('user game stats', () => {
    it('reports no totals when the user has no counted games', () => {
        expect(summarize([])).toEqual({ titles: [], countedGames: [] })
    })

    it('counts only Counted Games: no Forks, Explorations, Hotseat Play, abandoned games, or games without the User as a Player', () => {
        const stats = summarize([
            finished(1, ['me']),
            finished(2, ['me'], { parentId: 'game-1' }),
            finished(3, ['me'], { category: GameCategory.Exploration }),
            finished(4, ['me'], { hotseat: true }),
            finished(5, [], { result: GameResult.Abandoned }),
            finished(6, ['ann'], { users: ['ann', 'bo'] })
        ])
        expect(stats.total?.plays).toBe(1)
    })

    it('rejects a Finished game that has no result', () => {
        expect(() => summarize([finished(1, ['me'], { result: undefined })])).toThrow(
            'Finished games require a result'
        )
    })

    it('splits a tied win among its winners and compares it with even odds', () => {
        const stats = summarize([
            finished(1, ['me']),
            finished(2, ['me', 'ann']),
            finished(3, ['bo']),
            finished(4, ['ann'], { users: ['me', 'ann'] })
        ])
        expect(stats.total).toMatchObject({ plays: 4, wins: 1, ties: 1, losses: 2 })
        expect(stats.total?.winRate).toBeCloseTo(1.5 / 4)
        expect(stats.total?.evenOddsWinRate).toBeCloseTo((1 / 3 + 1 / 3 + 1 / 3 + 1 / 2) / 4)
        expect(stats.total?.playerCounts).toEqual([
            { playerCount: 2, plays: 1, winRate: 0, evenOddsWinRate: 1 / 2 },
            { playerCount: 3, plays: 3, winRate: 0.5, evenOddsWinRate: 1 / 3 }
        ])
    })

    it('tracks win streaks in completion order regardless of input order', () => {
        const games = [
            finished(1, ['me']),
            finished(2, ['me']),
            finished(3, ['me']),
            finished(4, ['me', 'ann']),
            finished(5, ['bo']),
            finished(6, ['me']),
            finished(7, ['me'])
        ]
        const stats = summarize(games.toReversed())
        expect(stats.total).toMatchObject({ bestWinStreak: 3, currentWinStreak: 2 })
        expect(stats.total?.recentOutcomes).toEqual([
            PlayOutcome.Won,
            PlayOutcome.Won,
            PlayOutcome.Won,
            PlayOutcome.Tied,
            PlayOutcome.Lost,
            PlayOutcome.Won,
            PlayOutcome.Won
        ])
        expect(stats).toEqual(summarize(games))
    })

    it('keeps only the latest twenty outcomes', () => {
        const games = Array.from({ length: 23 }, (_, index) =>
            finished(index + 1, [index < 3 ? 'ann' : 'me'])
        )
        expect(summarize(games).total?.recentOutcomes).toEqual(
            Array.from({ length: 20 }, () => PlayOutcome.Won)
        )
    })

    it('summarizes each title separately, most played first', () => {
        const stats = summarize([
            finished(1, ['ann'], { typeId: 'kaivai' }),
            finished(2, ['me']),
            finished(3, ['me']),
            finished(4, ['bo'], { typeId: 'bus' })
        ])
        expect(stats.titles.map((title) => [title.titleId, title.summary.plays])).toEqual([
            ['freshfish', 2],
            ['bus', 1],
            ['kaivai', 1]
        ])
        expect(stats.titles[0].summary).toMatchObject({ wins: 2, losses: 0, winRate: 1 })
        expect(stats.titles[2].summary).toMatchObject({ wins: 0, losses: 1, winRate: 0 })
    })

    it('records outright wins against each Opponent under their latest name', () => {
        const stats = summarize([
            finished(1, ['me']),
            finished(2, ['ann']),
            finished(3, ['me', 'ann'], {
                players: [player('me'), player('ann', 'Ann the Great')]
            }),
            finished(4, ['bo'], { users: ['me', 'bo'] })
        ])
        expect(stats.total?.opponentCount).toBe(2)
        expect(stats.total?.opponents).toEqual([
            { name: 'Ann the Great', plays: 3, wins: 1, opponentWins: 1 },
            { name: 'bo', plays: 3, wins: 1, opponentWins: 1 }
        ])
    })

    it('lists the six most played Opponents while counting all of them', () => {
        const rivals = Array.from({ length: 8 }, (_, index) => `rival-${index}`)
        const games = rivals.flatMap((rival, index) =>
            Array.from({ length: 8 - index }, (_, repeat) =>
                finished(index * 10 + repeat + 1, ['me'], { users: ['me', rival] })
            )
        )
        const stats = summarize(games)
        expect(stats.total?.opponentCount).toBe(8)
        expect(stats.total?.opponents.map((opponent) => opponent.name)).toEqual(rivals.slice(0, 6))
    })

    it('measures game length and tournament tables', () => {
        const tournament = { tournamentId: 't', stageId: 's', scheduleId: 'sc', tableId: 'tb' }
        const stats = summarize([
            finished(1, ['me'], { tournament }),
            finished(2, ['ann'], { tournament }),
            finished(30, ['me', 'ann'], { startedAt: new Date(START + 20 * DAY) })
        ])
        expect(stats.total).toMatchObject({
            firstFinishedAt: START + DAY,
            lastFinishedAt: START + 30 * DAY,
            tournamentPlays: 2,
            tournamentWins: 1
        })
        expect(stats.total?.averageDays).toBeCloseTo((2 + 2 + 10) / 3)
    })

    it('lists each Counted Game with its completion instant and Outcome, oldest first', () => {
        const stats = summarize([
            finished(3, ['me', 'ann'], { typeId: 'kaivai' }),
            finished(1, ['me']),
            finished(2, ['bo']),
            finished(4, ['me'], { hotseat: true })
        ])
        expect(stats.countedGames).toEqual([
            { titleId: 'freshfish', finishedAt: START + DAY, outcome: PlayOutcome.Won },
            { titleId: 'freshfish', finishedAt: START + 2 * DAY, outcome: PlayOutcome.Lost },
            { titleId: 'kaivai', finishedAt: START + 3 * DAY, outcome: PlayOutcome.Tied }
        ])
    })

    it('places recorded winners first and other Players by final score', () => {
        const users = ['me', 'ann', 'bo', 'cy']
        const scored = (day: number, winners: string[], points: number[]) =>
            finished(day, winners, {
                users,
                finalScores: Object.fromEntries(
                    users.map((user, index) => [`player-${user}`, points[index]])
                )
            })
        const finishOf = (game: GameStatsSource) => summarize([game]).total?.finishes?.average

        expect(finishOf(scored(1, ['me'], [9, 7, 5, 3]))).toBe(1)
        expect(finishOf(scored(2, ['ann'], [7, 9, 5, 3]))).toBe(2)
        expect(finishOf(scored(3, ['ann'], [3, 9, 5, 7]))).toBe(4)
        expect(finishOf(scored(4, ['ann'], [5, 9, 5, 3]))).toBe(2)
        expect(finishOf(scored(5, ['ann'], [9, 9, 5, 3]))).toBe(2)
        expect(finishOf(scored(6, ['me', 'ann'], [9, 9, 5, 3]))).toBe(1)
        expect(finishOf(scored(7, ['bo', 'cy'], [4, 6, 9, 9]))).toBe(4)
    })

    it('averages finishes over scored games only and reports the table size they were played at', () => {
        const stats = summarize([
            finished(1, ['me'], {
                finalScores: { 'player-me': 9, 'player-ann': 4, 'player-bo': 2 }
            }),
            finished(2, ['ann'], {
                users: ['me', 'ann'],
                finalScores: { 'player-me': 1, 'player-ann': 6 }
            }),
            finished(3, ['bo'])
        ])
        expect(stats.total?.plays).toBe(3)
        expect(stats.total?.finishes).toEqual({ average: 1.5, averagePlayerCount: 2.5 })
        expect(summarize([finished(1, ['me'])]).total?.finishes).toBeUndefined()
    })

    it('reports best and average score per title, never across titles', () => {
        const stats = summarize([
            finished(1, ['me'], {
                finalScores: { 'player-me': 9, 'player-ann': 4, 'player-bo': 2 }
            }),
            finished(2, ['ann'], {
                finalScores: { 'player-me': -3, 'player-ann': 4, 'player-bo': 2 }
            }),
            finished(3, ['me'], {
                typeId: 'indonesia',
                finalScores: { 'player-me': 900, 'player-ann': 400, 'player-bo': 200 }
            }),
            finished(4, ['bo'], { typeId: 'container' })
        ])
        expect(
            Object.fromEntries(stats.titles.map((title) => [title.titleId, title.scores]))
        ).toEqual({
            freshfish: { best: 9, average: 3 },
            indonesia: { best: 900, average: 900 },
            container: undefined
        })
        expect(stats.total).not.toHaveProperty('scores')
    })
})
