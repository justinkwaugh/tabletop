import { describe, expect, it } from 'vitest'
import { pawnPlace } from './cardFlows.js'

describe('a pawn as a player reads it: by where it stands (R-1.1)', () => {
    it('R-3.6 names its character and its space, never its number', () => {
        expect(pawnPlace({ character: 'knight', spaceId: 'space.desert.4' })).toBe(
            'Knight at Desert 4'
        )
    })

    it('R-4.2.2 says which vessel it rides', () => {
        expect(pawnPlace({ character: 'monk', spaceId: 'space.sea.2', vessel: 'ship' })).toBe(
            'Monk at Sea 2, on a ship'
        )
        expect(
            pawnPlace({ character: 'noble', spaceId: 'space.sea.2', vessel: 'flying-machine' })
        ).toBe('Noble at Sea 2, on a flying machine')
    })
})
