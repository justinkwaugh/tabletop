import { describe, expect, it } from 'vitest'
import { Suit } from '../components/cards.js'
import { callableKings, FourthKing, isCalledKing } from './kingCall.js'

describe('calling a king', () => {
    it('offers "the fourth king" only to a declarer holding exactly three kings', () => {
        const three = ['hearts-K', 'diamonds-K', 'spades-K', 'trump-5']
        expect(callableKings(three)).toContain(FourthKing)
        expect(callableKings(['hearts-K', 'diamonds-K', 'trump-5'])).not.toContain(FourthKing)
        expect(callableKings([...three, 'clubs-K'])).not.toContain(FourthKing)
    })

    it('offers only kings declarer does not hold', () => {
        expect(callableKings(['hearts-K', 'trump-5'])).toEqual([
            Suit.Diamonds,
            Suit.Spades,
            Suit.Clubs
        ])
        expect(callableKings(['hearts-K', 'diamonds-K', 'spades-K'])).toEqual([
            Suit.Clubs,
            FourthKing
        ])
        expect(callableKings(['hearts-K', 'diamonds-K', 'spades-K', 'clubs-K'])).toEqual([])
    })

    it('recognises the called king: the named one, or after "the fourth king" any king not declarer’s', () => {
        expect(isCalledKing(Suit.Clubs, 'clubs-K', false)).toBe(true)
        expect(isCalledKing(Suit.Clubs, 'hearts-K', false)).toBe(false)
        expect(isCalledKing(FourthKing, 'clubs-K', false)).toBe(true)
        expect(isCalledKing(FourthKing, 'hearts-K', true)).toBe(false)
        expect(isCalledKing(FourthKing, 'trump-21', false)).toBe(false)
    })
})
