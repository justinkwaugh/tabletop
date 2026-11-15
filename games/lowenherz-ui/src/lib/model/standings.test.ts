import { describe, expect, it } from 'vitest'
import { withSharedPlaces } from './standings.js'

describe('withSharedPlaces', () => {
    it('ranks highest first and lets equal totals share a place', () => {
        expect(
            withSharedPlaces([
                { playerId: 'a', total: 12 },
                { playerId: 'b', total: 30 },
                { playerId: 'c', total: 30 },
                { playerId: 'd', total: 7 }
            ])
        ).toEqual([
            { playerId: 'b', total: 30, place: 1 },
            { playerId: 'c', total: 30, place: 1 },
            { playerId: 'a', total: 12, place: 3 },
            { playerId: 'd', total: 7, place: 4 }
        ])
    })
})
