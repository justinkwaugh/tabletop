import { describe, expect, it } from 'vitest'
import { GameResult, PlayerStatus, rankedTiebreak, type Tournament } from '@tabletop/common'
import {
    applyTournamentGameScore,
    compareTournamentScores,
    createTournamentStandings
} from './tournamentScoring.js'

function miniTournament(): Tournament {
    return {
        id: 'mini',
        name: 'Mini',
        description: '',
        organizerId: 'admin',
        status: 'inProgress',
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
        entrants: ['a', 'b', 'c'].map((userId) => ({ userId, joinedAt: 1 })),
        stages: [],
        format: {
            kind: 'mini',
            stages: [{ id: 'main', name: 'Main', gamesPerEntrant: 3 }]
        },
        rules: {
            titleId: 'test',
            tableSize: 3,
            concurrency: 3,
            gameConfig: {},
            scoring: 'splitWinsV1',
            registration: { kind: 'whenFull', capacity: 3 }
        }
    }
}

function tableGame(tournament: Tournament, result: GameResult, winningPlayerIds: string[]) {
    return {
        players: tournament.entrants.map(({ userId }) => ({
            id: userId,
            userId,
            name: userId,
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        result,
        winningPlayerIds
    }
}

describe('split win points', () => {
    it.each([GameResult.Win, GameResult.Draw])(
        'splits %s credit equally and reverses it exactly',
        (result) => {
            const tournament = miniTournament()
            const standings = createTournamentStandings(tournament)
            const game = tableGame(tournament, result, ['a', 'b', 'c'])
            expect(() =>
                applyTournamentGameScore(tournament, standings, { ...game, winningPlayerIds: [] })
            ).toThrow('must declare winners')
            expect(standings).toEqual(createTournamentStandings(tournament))
            for (let index = 0; index < 3; index++)
                applyTournamentGameScore(tournament, standings, game)
            expect(standings.map((row) => row.score)).toEqual([1, 1, 1])
            for (let index = 0; index < 3; index++)
                applyTournamentGameScore(tournament, standings, game, -1)
            expect(standings).toEqual(createTournamentStandings(tournament))
            applyTournamentGameScore(tournament, standings, { ...game, winningPlayerIds: ['a'] })
            expect(standings[0].score).toBe(1)
        }
    )
})

describe('tiebreak totals', () => {
    it('totals final scores for every player and reverses them exactly', () => {
        const tournament = miniTournament()
        const standings = createTournamentStandings(tournament)
        const game = tableGame(tournament, GameResult.Win, ['a'])
        expect(standings.every((row) => row.tiebreak === undefined)).toBe(true)
        expect(() =>
            applyTournamentGameScore(tournament, standings, game, 1, { a: 10, b: 8 })
        ).toThrow('cover every game player')
        applyTournamentGameScore(tournament, standings, game, 1, { a: 10, b: 8, c: 7 })
        applyTournamentGameScore(tournament, standings, game, 1, { a: 12, b: 9, c: 30 })
        expect(standings.map((row) => row.tiebreak)).toEqual([22, 17, 37])
        applyTournamentGameScore(tournament, standings, game)
        expect(standings.map((row) => row.tiebreak)).toEqual([22, 17, 37])
        applyTournamentGameScore(tournament, standings, game, -1, { a: 12, b: 9, c: 30 })
        expect(standings.map((row) => row.tiebreak)).toEqual([10, 8, 7])
    })

    it('orders by tournament score first and tiebreak only among ties', () => {
        const rows = [
            { wins: 1, score: 1, completed: 3, tiebreak: 5 },
            { wins: 2, score: 1, completed: 3, tiebreak: 9 },
            { wins: 0, score: 0, completed: 3, tiebreak: 100 },
            { wins: 1, score: 1, completed: 3 }
        ]
        const ordered = [...rows].sort(compareTournamentScores)
        expect(ordered).toEqual([rows[1], rows[0], rows[3], rows[2]])
        expect(compareTournamentScores(rows[0], { ...rows[0] })).toBe(0)
        expect(compareTournamentScores(rows[3], { ...rows[3], tiebreak: 0 })).toBe(0)
    })
})

describe('points behind the top score', () => {
    function pointsBehindTournament(): Tournament {
        const tournament = miniTournament()
        tournament.rules.tiebreakRule = 'pointsBehind'
        return tournament
    }

    function scoredGame(tournament: Tournament) {
        const standings = createTournamentStandings(tournament)
        const game = tableGame(tournament, GameResult.Win, ['a'])
        applyTournamentGameScore(tournament, standings, game, 1, { a: 4, b: -3, c: 1 })
        return standings
    }

    it("totals each player's gap to the table top score and reverses it exactly", () => {
        const tournament = pointsBehindTournament()
        const standings = scoredGame(tournament)
        const game = tableGame(tournament, GameResult.Win, ['a'])
        applyTournamentGameScore(tournament, standings, game, 1, { a: -6, b: -8, c: -6 })
        expect(standings.map((row) => row.pointsBehind)).toEqual([0, 9, 3])
        expect(standings.map((row) => row.tiebreak)).toEqual([-2, -11, -5])
        applyTournamentGameScore(tournament, standings, game, -1, { a: -6, b: -8, c: -6 })
        expect(standings.map((row) => row.pointsBehind)).toEqual([0, 7, 3])
    })

    it('stays on final score totals without the rule, whatever the rows already hold', () => {
        const standings = scoredGame(miniTournament())
        expect(standings.map((row) => row.tiebreak)).toEqual([4, -3, 1])
        expect(standings.every((row) => row.pointsBehind === undefined)).toBe(true)
    })

    it('ranks by the per-game average, lower first, after tournament score', () => {
        const fewerGames = { score: 1, completed: 2, tiebreak: 0, pointsBehind: 6 }
        const moreGames = { score: 1, completed: 4, tiebreak: 0, pointsBehind: 8 }
        expect([fewerGames, moreGames].sort(compareTournamentScores)).toEqual([
            moreGames,
            fewerGames
        ])
        expect(compareTournamentScores({ ...fewerGames, score: 2 }, moreGames)).toBeLessThan(0)
        expect(compareTournamentScores(moreGames, { ...fewerGames, pointsBehind: 4 })).toBe(0)
    })

    it('separates an equal average by the average final score, per game', () => {
        const higher = { score: 1, completed: 4, pointsBehind: 8, tiebreak: -8 }
        const lower = { score: 1, completed: 2, pointsBehind: 4, tiebreak: -6 }
        expect([lower, higher].sort(compareTournamentScores)).toEqual([higher, lower])
        expect(compareTournamentScores(higher, { ...higher })).toBe(0)
    })

    it('adds one hundredth of the average final score to the negated average', () => {
        expect(rankedTiebreak({ completed: 4, pointsBehind: 7, tiebreak: -10 })).toBe(-1.775)
        expect(rankedTiebreak({ completed: 1, pointsBehind: 0, tiebreak: 5 })).toBe(0.05)
        expect(Object.is(rankedTiebreak({ completed: 1, pointsBehind: 0, tiebreak: 0 }), 0)).toBe(
            true
        )
        expect(rankedTiebreak({ completed: 4, tiebreak: -10 })).toBe(-10)
        expect(rankedTiebreak({ completed: 0 })).toBeUndefined()
    })

    it('treats mathematically equal values as a tie despite different terms', () => {
        const oneGame = { score: 0, completed: 1, pointsBehind: 0, tiebreak: -47 }
        const twoGames = { score: 0, completed: 2, pointsBehind: 1, tiebreak: 6 }
        expect(compareTournamentScores(oneGame, twoGames)).toBe(0)
    })

    it('ranks a place with no games below everyone level with it who has played', () => {
        const played = { score: 0, completed: 3, pointsBehind: 6, tiebreak: -30 }
        const unplayed = { score: 0, completed: 0 }
        expect(compareTournamentScores(played, unplayed)).toBeLessThan(0)
        expect(compareTournamentScores(unplayed, played)).toBeGreaterThan(0)
        expect(compareTournamentScores(unplayed, { ...unplayed })).toBe(0)
    })

    it('compares rows on different rules by average final score', () => {
        const rule = { score: 1, completed: 4, pointsBehind: 8, tiebreak: -8 }
        const totals = { score: 1, completed: 4, tiebreak: -60 }
        expect(compareTournamentScores(rule, totals)).toBeLessThan(0)
        expect(compareTournamentScores({ ...totals, tiebreak: 4 }, rule)).toBeLessThan(0)
    })

    it('leaves a title without the rule comparing a missing total as zero', () => {
        const played = { score: 0, completed: 3, tiebreak: -5 }
        expect(compareTournamentScores({ score: 0, completed: 0 }, played)).toBeLessThan(0)
    })
})
