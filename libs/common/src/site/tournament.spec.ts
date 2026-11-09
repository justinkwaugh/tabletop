import { describe, expect, it } from 'vitest'
import { PlayerStatus, type Player } from '../game/model/player.js'
import { sortedEqualGroups } from '../util/sortedEqualGroups.js'
import {
    formatTournamentTiebreaks,
    tournamentAveragePlace,
    tournamentTiebreakDescription,
    tournamentGameFinishingPlaces,
    tournamentFinishingPlacesConsistent,
    tournamentFinishingWinners,
    tournamentFinishingPlacesFromGroups
} from './tournament.js'

function player(userId: string): Player {
    return {
        id: `player-${userId}`,
        userId,
        name: userId,
        isHuman: true,
        status: PlayerStatus.Joined
    }
}

const players = ['a', 'b', 'c', 'd'].map(player)

describe('tournamentGameFinishingPlaces', () => {
    it('puts the declared winners first and the rest by final score', () => {
        const places = tournamentGameFinishingPlaces(
            { players, winningPlayerIds: ['player-b'] },
            { 'player-a': 6100, 'player-b': 6100, 'player-c': 7000, 'player-d': 4200 }
        )
        expect(places).toEqual({ b: 1, c: 2, a: 3, d: 4 })
    })

    it('shares places between shared winners and equal final scores', () => {
        const places = tournamentGameFinishingPlaces(
            { players, winningPlayerIds: ['player-a', 'player-d'] },
            { 'player-a': 9, 'player-b': 5, 'player-c': 5, 'player-d': 9 }
        )
        expect(places).toEqual({ a: 1.5, d: 1.5, b: 3.5, c: 3.5 })
    })
})

describe('tournamentFinishingPlacesFromGroups', () => {
    it('gives a shared place the average of the places it spans', () => {
        expect(tournamentFinishingPlacesFromGroups([['a', 'd'], ['b'], ['c']])).toEqual({
            a: 1.5,
            d: 1.5,
            b: 3,
            c: 4
        })
        expect(tournamentFinishingPlacesFromGroups([['a'], ['b', 'c', 'd']])).toEqual({
            a: 1,
            b: 3,
            c: 3,
            d: 3
        })
    })
})

describe('tournamentFinishingPlacesConsistent', () => {
    it('accepts only places their positions give', () => {
        expect(tournamentFinishingPlacesConsistent({ a: 1.5, b: 1.5, c: 3, d: 4 })).toBe(true)
        expect(tournamentFinishingPlacesConsistent({ a: 1, b: 1, c: 3, d: 4 })).toBe(false)
        expect(tournamentFinishingPlacesConsistent({ a: 1, b: 2, c: 2, d: 4 })).toBe(false)
        expect(tournamentFinishingPlacesConsistent({ a: 2, b: 3 })).toBe(false)
    })
})

describe('tournamentFinishingWinners', () => {
    it('names everyone sharing the best place', () => {
        expect(tournamentFinishingWinners({ a: 3, b: 1.5, c: 1.5, d: 4 })).toEqual(['b', 'c'])
    })
})

describe('sortedEqualGroups', () => {
    it('sorts and groups neighbours the comparison calls equal', () => {
        expect(sortedEqualGroups([3, 1, 3, 2, 1], (a, b) => a - b)).toEqual([[1, 1], [2], [3, 3]])
        expect(sortedEqualGroups([], (a: number, b: number) => a - b)).toEqual([])
    })
})

describe('tournamentAveragePlace', () => {
    it('averages over the games played and has none before any', () => {
        expect(tournamentAveragePlace({ completed: 4, placeTotal: 9 })).toBe(2.25)
        expect(tournamentAveragePlace({ completed: 0, placeTotal: 0 })).toBeUndefined()
        expect(tournamentAveragePlace({ completed: 4 })).toBeUndefined()
    })
})

describe('formatTournamentTiebreaks', () => {
    it('shows a share of the winner as a percentage and other rules as numbers', () => {
        expect(
            formatTournamentTiebreaks([
                { completed: 4, tiebreak: 24000, shareOfWinner: 34972 },
                { completed: 4, tiebreak: -10, pointsBehind: 7 },
                { completed: 4, tiebreak: 1234.5 },
                { completed: 0, shareOfWinner: 0 }
            ])
        ).toEqual(['87.43%', '-1.775', '1,234.5', undefined])
    })
})

describe('tournamentTiebreakDescription', () => {
    it('explains the rule the rows carry', () => {
        expect(tournamentTiebreakDescription([{}, { shareOfWinner: 0 }])).toContain('percentage')
        expect(tournamentTiebreakDescription([{ pointsBehind: 0 }])).toContain('points behind')
        expect(tournamentTiebreakDescription([{}])).toContain('sum')
    })
})
