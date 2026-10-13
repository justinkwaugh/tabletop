import { describe, expect, it } from 'vitest'
import { signed } from './signed.js'

describe('a combat result as it is written', () => {
    it('carries a plus sign when the attack is ahead', () => {
        expect(signed(2)).toBe('+2')
    })

    it('carries no sign at zero and its own sign below', () => {
        expect(signed(0)).toBe('0')
        expect(signed(-3)).toBe('-3')
    })
})
