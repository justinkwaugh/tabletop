import { describe, expect, it } from 'vitest'
import { cardLabel, cardWidthShare, romanNumeral, StandardStyle } from './cardStyle.js'

const uniform = { uniformPips: true, classicDeck: false }
const classic = { uniformPips: false, classicDeck: true }

describe('card labels', () => {
    it('names trumps by their corner number and the Sküs by name', () => {
        expect(cardLabel('trump-21', StandardStyle)).toBe('21')
        expect(cardLabel('trump-4', StandardStyle)).toBe('4')
        expect(cardLabel('trump-22', StandardStyle)).toBe('Sküs')
    })

    it('names the Industrie und Glück trumps by their Roman numerals, with IIII for four', () => {
        expect(romanNumeral(4)).toBe('IIII')
        expect(romanNumeral(19)).toBe('XIX')
        expect(romanNumeral(14)).toBe('XIV')
        expect(romanNumeral(9)).toBe('IX')
        expect(cardLabel('trump-21', classic)).toBe('XXI')
        expect(cardLabel('trump-22', classic)).toBe('Sküs')
        expect(cardLabel('hearts-1', { ...classic, uniformPips: true })).toBe('10♥')
    })

    it('draws each pack in its own proportion, at the same height', () => {
        const height = 9 / 5
        expect(cardWidthShare(StandardStyle) / height).toBeCloseTo(229 / 432)
        expect(cardWidthShare(classic) / height).toBeCloseTo(239 / 432)
    })

    it('shows red pips 1 2 3 4 as 10 9 8 7 with uniform pips', () => {
        expect(cardLabel('hearts-1', StandardStyle)).toBe('1♥')
        expect(cardLabel('hearts-1', uniform)).toBe('10♥')
        expect(cardLabel('diamonds-4', uniform)).toBe('7♦')
        expect(cardLabel('spades-7', uniform)).toBe('7♠')
        expect(cardLabel('clubs-K', uniform)).toBe('K♣')
    })
})
