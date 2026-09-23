import { describe, expect, it } from 'vitest'
import { GameResult, PlayerStatus, type Tournament } from '@tabletop/common'
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
