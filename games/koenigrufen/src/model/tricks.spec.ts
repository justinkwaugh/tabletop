import { describe, expect, it } from 'vitest'
import { legalPlays, trickWinner, type PlayRules } from './tricks.js'

const plays = (...cardIds: string[]) =>
    cardIds.map((cardId, index) => ({ playerId: `p${index}`, cardId }))

describe('legal plays', () => {
    const hand = ['hearts-K', 'hearts-3', 'clubs-10', 'trump-5', 'trump-22']

    it('allows anything on the lead', () => {
        expect(legalPlays(hand, [])).toEqual(hand)
    })

    it('requires following suit', () => {
        expect(legalPlays(hand, plays('hearts-Q'))).toEqual(['hearts-K', 'hearts-3'])
    })

    it('requires a trump without the suit led', () => {
        expect(legalPlays(hand, plays('spades-7'))).toEqual(['trump-5', 'trump-22'])
    })

    it('requires a trump on a trump lead', () => {
        expect(legalPlays(hand, plays('trump-2'))).toEqual(['trump-5', 'trump-22'])
    })

    it('allows anything with neither the suit nor a trump', () => {
        const noTrumps = ['hearts-K', 'clubs-10']
        expect(legalPlays(noTrumps, plays('spades-7'))).toEqual(noTrumps)
        expect(legalPlays(noTrumps, plays('trump-2'))).toEqual(noTrumps)
    })
})

describe('the trick winner', () => {
    it('is the highest card of the suit led without trumps', () => {
        expect(trickWinner(plays('hearts-2', 'hearts-1', 'clubs-K', 'hearts-3'), true)).toBe('p1')
        expect(trickWinner(plays('spades-7', 'spades-10', 'spades-J', 'hearts-K'), true)).toBe('p2')
    })

    it('is the highest trump', () => {
        expect(trickWinner(plays('hearts-K', 'trump-2', 'trump-21', 'trump-3'), true)).toBe('p2')
        expect(trickWinner(plays('trump-21', 'trump-22', 'trump-1', 'trump-3'), true)).toBe('p1')
    })

    it('ignores trumps on a suit lead where trumps do not win', () => {
        expect(trickWinner(plays('hearts-2', 'trump-21', 'hearts-1', 'trump-3'), false)).toBe('p2')
        expect(trickWinner(plays('trump-4', 'trump-21', 'hearts-1', 'trump-3'), false)).toBe('p1')
    })
})

describe('negative games', () => {
    const negative: PlayRules = { trumpsWin: true, mustBeat: true }

    it('make you beat the highest card so far when you can', () => {
        expect(legalPlays(['hearts-K', 'hearts-3'], plays('hearts-Q'), negative)).toEqual([
            'hearts-K'
        ])
        expect(legalPlays(['hearts-4', 'hearts-3'], plays('hearts-1'), negative)).toEqual([
            'hearts-4',
            'hearts-3'
        ])
    })

    it('make a player without the suit overtrump when they can', () => {
        expect(legalPlays(['trump-5', 'trump-9'], plays('spades-7', 'trump-7'), negative)).toEqual([
            'trump-9'
        ])
    })

    it('allow the Pagat only as the last trump', () => {
        expect(legalPlays(['trump-1', 'trump-5', 'hearts-3'], [], negative)).toEqual([
            'trump-5',
            'hearts-3'
        ])
        expect(legalPlays(['trump-1', 'trump-5'], plays('spades-7'), negative)).toEqual(['trump-5'])
        expect(legalPlays(['trump-1', 'hearts-3'], [], negative)).toEqual(['trump-1', 'hearts-3'])
    })
})

describe('colour games', () => {
    const colour: PlayRules = { trumpsWin: false, mustBeat: false }

    it('forbid leading a trump while holding a suit card', () => {
        expect(legalPlays(['trump-5', 'hearts-3'], [], colour)).toEqual(['hearts-3'])
        expect(legalPlays(['trump-5', 'trump-9'], [], colour)).toEqual(['trump-5', 'trump-9'])
    })

    it('hold trumps back while a player without the suit led has other suit cards', () => {
        expect(legalPlays(['trump-5', 'hearts-3'], plays('spades-7'), colour)).toEqual(['hearts-3'])
        expect(legalPlays(['trump-5', 'trump-9'], plays('spades-7'), colour)).toEqual([
            'trump-5',
            'trump-9'
        ])
    })

    it('still make players follow a trump lead', () => {
        expect(legalPlays(['trump-5', 'hearts-3'], plays('trump-2'), colour)).toEqual(['trump-5'])
    })
})
