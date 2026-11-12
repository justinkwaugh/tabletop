import { describe, expect, it } from 'vitest'
import {
    GameResult,
    PlayerStatus,
    rankedTiebreak,
    tournamentFinishingPlacesFromGroups,
    type Tournament
} from '@tabletop/common'
import {
    applyTournamentGameScore,
    compareTournamentScores,
    createTournamentStandings,
    tournamentPlacings,
    type TournamentTableResult
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
                applyTournamentGameScore(tournament, standings, game, { direction: -1 })
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
            applyTournamentGameScore(tournament, standings, game, { finalScores: { a: 10, b: 8 } })
        ).toThrow('cover every game player')
        applyTournamentGameScore(tournament, standings, game, {
            finalScores: { a: 10, b: 8, c: 7 }
        })
        applyTournamentGameScore(tournament, standings, game, {
            finalScores: { a: 12, b: 9, c: 30 }
        })
        expect(standings.map((row) => row.tiebreak)).toEqual([22, 17, 37])
        applyTournamentGameScore(tournament, standings, game)
        expect(standings.map((row) => row.tiebreak)).toEqual([22, 17, 37])
        applyTournamentGameScore(tournament, standings, game, {
            direction: -1,
            finalScores: { a: 12, b: 9, c: 30 }
        })
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
        applyTournamentGameScore(tournament, standings, game, {
            finalScores: { a: 4, b: -3, c: 1 }
        })
        return standings
    }

    it("totals each player's gap to the table top score and reverses it exactly", () => {
        const tournament = pointsBehindTournament()
        const standings = scoredGame(tournament)
        const game = tableGame(tournament, GameResult.Win, ['a'])
        applyTournamentGameScore(tournament, standings, game, {
            finalScores: { a: -6, b: -8, c: -6 }
        })
        expect(standings.map((row) => row.pointsBehind)).toEqual([0, 9, 3])
        expect(standings.map((row) => row.tiebreak)).toEqual([-2, -11, -5])
        applyTournamentGameScore(tournament, standings, game, {
            direction: -1,
            finalScores: { a: -6, b: -8, c: -6 }
        })
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

describe('average place', () => {
    function placementTournament(): Tournament {
        const tournament = miniTournament()
        tournament.rules.scoring = 'placementV1'
        return tournament
    }

    it('totals finishing places from final scores, winners first, and reverses them exactly', () => {
        const tournament = placementTournament()
        const standings = createTournamentStandings(tournament)
        expect(standings.map((row) => row.placeTotal)).toEqual([0, 0, 0])
        const game = tableGame(tournament, GameResult.Win, ['b'])
        applyTournamentGameScore(tournament, standings, game, { finalScores: { a: 9, b: 9, c: 4 } })
        expect(standings.map((row) => row.placeTotal)).toEqual([2, 1, 3])
        applyTournamentGameScore(tournament, standings, game, { finalScores: { a: 5, b: 9, c: 5 } })
        expect(standings.map((row) => row.placeTotal)).toEqual([4.5, 2, 5.5])
        applyTournamentGameScore(tournament, standings, game, {
            direction: -1,
            finalScores: { a: 5, b: 9, c: 5 }
        })
        expect(standings.map((row) => row.placeTotal)).toEqual([2, 1, 3])
    })

    it('splits a shared win across the places it spans', () => {
        const tournament = placementTournament()
        const standings = createTournamentStandings(tournament)
        const game = tableGame(tournament, GameResult.Draw, ['a', 'c'])
        applyTournamentGameScore(tournament, standings, game, { finalScores: { a: 3, b: 7, c: 3 } })
        expect(standings.map((row) => row.placeTotal)).toEqual([1.5, 3, 1.5])
    })

    it('uses corrected places instead of the final scores', () => {
        const tournament = placementTournament()
        const standings = createTournamentStandings(tournament)
        const game = tableGame(tournament, GameResult.Win, ['c'])
        applyTournamentGameScore(tournament, standings, game, {
            correctedPlaces: { c: 1, a: 2, b: 3 }
        })
        expect(standings.map((row) => row.placeTotal)).toEqual([2, 3, 1])
        expect(standings.every((row) => row.tiebreak === undefined)).toBe(true)
        expect(() =>
            applyTournamentGameScore(tournament, standings, game, {
                correctedPlaces: { c: 1, a: 2 }
            })
        ).toThrow('cover every player exactly once')
        expect(() => applyTournamentGameScore(tournament, standings, game)).toThrow(
            'needs final scores or corrected places'
        )
    })

    it('leaves win-point events without place totals', () => {
        const tournament = miniTournament()
        const standings = createTournamentStandings(tournament)
        applyTournamentGameScore(
            tournament,
            standings,
            tableGame(tournament, GameResult.Win, ['a']),
            { finalScores: { a: 3, b: 2, c: 1 } }
        )
        expect(standings.every((row) => row.placeTotal === undefined)).toBe(true)
    })

    it('ranks by average place, lower first, before wins and the tiebreak', () => {
        const winner = { score: 2, completed: 4, placeTotal: 10, tiebreak: 50 }
        const steady = { score: 0, completed: 4, placeTotal: 8, tiebreak: 0 }
        const fewer = { score: 0, completed: 2, placeTotal: 4, tiebreak: 10 }
        expect([winner, steady, fewer].sort(compareTournamentScores)).toEqual([
            fewer,
            steady,
            winner
        ])
        expect(compareTournamentScores({ ...steady, tiebreak: 5 }, { ...fewer, tiebreak: 5 })).toBe(
            0
        )
        expect(compareTournamentScores({ ...steady, tiebreak: 20 }, fewer)).toBeLessThan(0)
    })

    it('ranks a place with no games below everyone who has played', () => {
        const played = { score: 0, completed: 4, placeTotal: 16 }
        const unplayed = { score: 0, completed: 0, placeTotal: 0 }
        expect(compareTournamentScores(played, unplayed)).toBeLessThan(0)
        expect(compareTournamentScores(unplayed, { ...unplayed })).toBe(0)
    })
})

describe('placings', () => {
    const row = (userId: string, placeTotal: number, tiebreak = 0) => ({
        userId,
        score: 0,
        completed: 2,
        placeTotal,
        tiebreak
    })
    const ids = (groups: { userId: string }[][]) =>
        groups.map((group) => group.map((value) => value.userId).sort())

    it('separates an equal average place by finishing ahead more often, before the tiebreak', () => {
        const tables: TournamentTableResult[] = [
            {
                id: '1',
                entrantIds: ['a', 'b', 'x', 'y'],
                winnerIds: ['x'],
                finishingPlaces: tournamentFinishingPlacesFromGroups([['x'], ['b'], ['a'], ['y']])
            },
            {
                id: '2',
                entrantIds: ['a', 'b', 'x', 'y'],
                winnerIds: ['a'],
                finishingPlaces: tournamentFinishingPlacesFromGroups([['a'], ['y'], ['x'], ['b']])
            },
            {
                id: '3',
                entrantIds: ['b', 'c', 'x', 'y'],
                winnerIds: ['b'],
                finishingPlaces: tournamentFinishingPlacesFromGroups([['b'], ['c'], ['x'], ['y']])
            }
        ]
        // a and b split their two meetings; b and c met once, b ahead.
        expect(ids(tournamentPlacings([row('a', 5, 9), row('b', 5)], tables))).toEqual([
            ['a'],
            ['b']
        ])
        expect(ids(tournamentPlacings([row('b', 5), row('c', 5, 9)], tables))).toEqual([
            ['b'],
            ['c']
        ])
    })

    it('counts every pair among three or more tied places and halves a shared place', () => {
        const tables: TournamentTableResult[] = [
            {
                id: '4',
                entrantIds: ['a', 'b', 'c'],
                winnerIds: ['a'],
                finishingPlaces: tournamentFinishingPlacesFromGroups([['a'], ['b', 'c']])
            },
            {
                id: '5',
                entrantIds: ['a', 'b', 'c'],
                winnerIds: ['b'],
                finishingPlaces: tournamentFinishingPlacesFromGroups([['b'], ['c'], ['a']])
            }
        ]
        // a: 2, b: 3.5, c: 0.5 pairs won
        expect(ids(tournamentPlacings([row('a', 4), row('b', 4), row('c', 4)], tables))).toEqual([
            ['b'],
            ['a'],
            ['c']
        ])
    })

    it('leaves places that never met to the tiebreak and an equal tiebreak tied', () => {
        const tables: TournamentTableResult[] = [
            {
                id: '6',
                entrantIds: ['a', 'x'],
                winnerIds: ['a'],
                finishingPlaces: tournamentFinishingPlacesFromGroups([['a'], ['x']])
            },
            { id: '7', entrantIds: ['b', 'y'], winnerIds: ['b'] }
        ]
        expect(ids(tournamentPlacings([row('a', 3, 1), row('b', 3, 2)], tables))).toEqual([
            ['b'],
            ['a']
        ])
        expect(ids(tournamentPlacings([row('a', 3), row('b', 3)], tables))).toEqual([['a', 'b']])
    })

    it('never uses head-to-head for win points', () => {
        const tables: TournamentTableResult[] = [
            {
                id: '8',
                entrantIds: ['a', 'b'],
                winnerIds: ['a'],
                finishingPlaces: tournamentFinishingPlacesFromGroups([['a'], ['b']])
            }
        ]
        const wins = (userId: string, tiebreak: number) => ({
            userId,
            score: 1,
            completed: 1,
            tiebreak
        })
        expect(ids(tournamentPlacings([wins('a', 1), wins('b', 2)], tables))).toEqual([
            ['b'],
            ['a']
        ])
        expect(ids(tournamentPlacings([wins('a', 1), wins('b', 1)], tables))).toEqual([['a', 'b']])
    })
})

describe('share of the winner', () => {
    function shareTournament(): Tournament {
        const tournament = miniTournament()
        tournament.rules.tiebreakRule = 'shareOfWinner'
        return tournament
    }

    it('totals each share in hundredths of a percent and reverses it exactly', () => {
        const tournament = shareTournament()
        const standings = createTournamentStandings(tournament)
        const game = tableGame(tournament, GameResult.Win, ['a'])
        applyTournamentGameScore(tournament, standings, game, {
            finalScores: { a: 8000, b: 6000, c: 0 }
        })
        expect(standings.map((row) => row.shareOfWinner)).toEqual([10000, 7500, 0])
        applyTournamentGameScore(tournament, standings, game, {
            finalScores: { a: 3000, b: 9000, c: 4500 }
        })
        expect(standings.map((row) => row.shareOfWinner)).toEqual([13333, 17500, 5000])
        expect(standings.every((row) => row.pointsBehind === undefined)).toBe(true)
        applyTournamentGameScore(tournament, standings, game, {
            direction: -1,
            finalScores: { a: 3000, b: 9000, c: 4500 }
        })
        expect(standings.map((row) => row.shareOfWinner)).toEqual([10000, 7500, 0])
        expect(() =>
            applyTournamentGameScore(tournament, standings, game, {
                finalScores: { a: 0, b: -5, c: -2 }
            })
        ).toThrow('positive top score')
    })

    it('ranks by the average share as a percentage, whatever the table wealth', () => {
        expect(rankedTiebreak({ completed: 4, tiebreak: 24000, shareOfWinner: 34972 })).toBe(87.43)
        const richTables = { score: 0, completed: 4, tiebreak: 36000, shareOfWinner: 34000 }
        const closeFinishes = { score: 0, completed: 4, tiebreak: 20000, shareOfWinner: 36000 }
        expect([richTables, closeFinishes].sort(compareTournamentScores)).toEqual([
            closeFinishes,
            richTables
        ])
        expect(
            compareTournamentScores(closeFinishes, {
                ...closeFinishes,
                completed: 2,
                shareOfWinner: 18000
            })
        ).toBe(0)
    })

    it('compares against rows on another rule by average final score', () => {
        const share = { score: 0, completed: 4, tiebreak: 24000, shareOfWinner: 36000 }
        const behind = { score: 0, completed: 4, tiebreak: 28000, pointsBehind: 0 }
        expect(compareTournamentScores(behind, share)).toBeLessThan(0)
    })
})
