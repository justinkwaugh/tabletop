import { describe, expect, it } from 'vitest'
import { FAVOR_BANK_ORDER, redistributeFavor } from './favorBanks.js'
import { Suit } from '../model/oathEnums.js'

/** Pinned as literals, because other specs index `FAVOR_BANK_ORDER` and would move with it. */
describe('favor bank order (R-2.6.1, R-5.4.4, R-8.4)', () => {
    it('R-5.4.4 — the transcribed order, closest to the world deck first', () => {
        expect([...FAVOR_BANK_ORDER]).toEqual([
            Suit.Discord,
            Suit.Arcane,
            Suit.Order,
            Suit.Hearth,
            Suit.Beast,
            Suit.Nomad
        ])
    })

    it('R-2.6.1 — all six suits, each exactly once', () => {
        expect(new Set(FAVOR_BANK_ORDER).size).toBe(6)
        expect([...FAVOR_BANK_ORDER].sort()).toEqual([...Object.values(Suit)].sort())
    })

    it('R-8.4 — “the next clockwise suit” is the next bank, wrapping', () => {
        expect(redistributeFavor(Suit.Discord, 3)).toEqual([
            Suit.Discord,
            Suit.Arcane,
            Suit.Order
        ])
        expect(redistributeFavor(Suit.Nomad, 3)).toEqual([
            Suit.Nomad,
            Suit.Discord,
            Suit.Arcane
        ])
    })
})
