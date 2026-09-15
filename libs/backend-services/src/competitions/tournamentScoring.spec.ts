import { describe, expect, it } from 'vitest'
import { GameResult, PlayerStatus, type Tournament } from '@tabletop/common'
import { applyTournamentGameScore, createTournamentStandings } from './tournamentScoring.js'

describe('split win points', () => {
    it.each([GameResult.Win, GameResult.Draw])(
        'splits %s credit equally and reverses it exactly',
        (result) => {
            const tournament: Tournament = {
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
            const standings = createTournamentStandings(tournament)
            const game = {
                players: tournament.entrants.map(({ userId }) => ({
                    id: userId,
                    userId,
                    name: userId,
                    isHuman: true,
                    status: PlayerStatus.Joined
                })),
                result,
                winningPlayerIds: ['a', 'b', 'c']
            }
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
