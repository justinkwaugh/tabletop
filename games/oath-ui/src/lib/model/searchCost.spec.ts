import { describe, expect, it } from 'vitest'
import { worldDeckPrice } from './searchCost.js'

describe('the world deck’s price in words (R-2.1.6)', () => {
    it('names the track’s cost, and the Darkest Secret holder’s 2 where it differs', () => {
        expect(worldDeckPrice(0)).toBe('2 Supply')
        expect(worldDeckPrice(1)).toBe('3 Supply, 2 for the Darkest Secret’s holder')
        expect(worldDeckPrice(5)).toBe('4 Supply, 2 for the Darkest Secret’s holder')
    })
})
