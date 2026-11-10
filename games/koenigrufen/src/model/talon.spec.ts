import { describe, expect, it } from 'vitest'
import {
    canLayAway,
    layAwayCandidates,
    shownDiscards,
    talonHalves,
    untouchedTalonHalfForDeclarer
} from './talon.js'

describe('laying away', () => {
    const hand = [
        'hearts-K',
        'hearts-Q',
        'clubs-10',
        'spades-7',
        'trump-1',
        'trump-5',
        'trump-21',
        'trump-22'
    ]

    it('takes exactly the right number of different cards from the hand', () => {
        expect(canLayAway(hand, ['hearts-Q', 'clubs-10', 'spades-7'], 3)).toBe(true)
        expect(canLayAway(hand, ['hearts-Q', 'clubs-10'], 3)).toBe(false)
        expect(canLayAway(hand, ['hearts-Q', 'hearts-Q', 'clubs-10'], 3)).toBe(false)
        expect(canLayAway(hand, ['hearts-Q', 'clubs-10', 'diamonds-1'], 3)).toBe(false)
    })

    it('never lays away a king or the Trull', () => {
        expect(canLayAway(hand, ['hearts-K', 'clubs-10', 'spades-7'], 3)).toBe(false)
        expect(canLayAway(hand, ['trump-22', 'clubs-10', 'spades-7'], 3)).toBe(false)
    })

    it('lays away other trumps only when the suit cards run out', () => {
        expect(canLayAway(hand, ['trump-5', 'clubs-10', 'spades-7'], 3)).toBe(false)
        const short = ['hearts-K', 'clubs-10', 'trump-5', 'trump-6', 'trump-22']
        expect(canLayAway(short, ['clubs-10', 'trump-5', 'trump-6'], 3)).toBe(true)
        expect(shownDiscards(['clubs-10', 'trump-5', 'trump-6'])).toEqual(['trump-5', 'trump-6'])
    })
})

describe('the talon', () => {
    it('is exposed in two halves of three', () => {
        expect(talonHalves(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual([
            ['a', 'b', 'c'],
            ['d', 'e', 'f']
        ])
    })
})

describe('an untouched talon holding the called king', () => {
    const talon = ['trump-10', 'trump-11', 'trump-12', 'diamonds-C', 'clubs-K', 'diamonds-J']
    const isClubsKing = (cardId: string) => cardId === 'clubs-K'

    it('gives declarer only the half with the king', () => {
        expect(untouchedTalonHalfForDeclarer(talon, isClubsKing)).toEqual([
            'diamonds-C',
            'clubs-K',
            'diamonds-J'
        ])
    })

    it('gives declarer nothing when the king is elsewhere', () => {
        expect(untouchedTalonHalfForDeclarer(talon, () => false)).toEqual([])
    })
})

describe('choosing cards to lay away', () => {
    const hand = ['hearts-K', 'hearts-Q', 'clubs-10', 'trump-5', 'trump-6', 'trump-22']

    it('offers suit cards other than kings while they can fill the places left', () => {
        expect(layAwayCandidates(hand, [], 2)).toEqual(['hearts-Q', 'clubs-10'])
        expect(layAwayCandidates(hand, ['hearts-Q'], 2)).toEqual(['clubs-10'])
    })

    it('adds trumps other than the Trull once the suit cards run short', () => {
        expect(layAwayCandidates(hand, [], 3)).toEqual([
            'hearts-Q',
            'clubs-10',
            'trump-5',
            'trump-6'
        ])
    })

    it('offers nothing once enough are chosen', () => {
        expect(layAwayCandidates(hand, ['hearts-Q', 'clubs-10'], 2)).toEqual([])
    })

    it('only ever leads to a legal set', () => {
        const chosen: string[] = []
        while (chosen.length < 3) {
            const [next] = layAwayCandidates(hand, chosen, 3).reverse()
            chosen.push(next)
        }
        expect(canLayAway(hand, chosen, 3)).toBe(true)
    })
})
