import { describe, expect, it } from 'vitest'
import { finalStandings } from './standings.js'

describe('final standings', () => {
    it('ranks by cash, shares ranks on ties in seating order, and skips the next rank', () => {
        const players = [
            { playerId: 'fred', money: 2100 },
            { playerId: 'alan', money: 5300 },
            { playerId: 'bart', money: 5500 },
            { playerId: 'steve', money: 5500 }
        ]
        expect(finalStandings(players, ['steve', 'alan', 'bart', 'fred'])).toEqual([
            { playerId: 'steve', money: 5500, rank: 1 },
            { playerId: 'bart', money: 5500, rank: 1 },
            { playerId: 'alan', money: 5300, rank: 3 },
            { playerId: 'fred', money: 2100, rank: 4 }
        ])
    })
})
