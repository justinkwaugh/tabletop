import { describe, expect, it } from 'vitest'
import { sortHand } from './handOrder.js'

const hand = [
    'trump-22',
    'hearts-K',
    'trump-1',
    'spades-7',
    'hearts-4',
    'spades-K',
    'trump-21',
    'hearts-1',
    'spades-10'
]

describe('the hand’s order', () => {
    it('runs each suit and the trumps from low to high, left to right', () => {
        expect(sortHand(hand, false)).toEqual([
            'hearts-4',
            'hearts-1',
            'hearts-K',
            'spades-7',
            'spades-10',
            'spades-K',
            'trump-1',
            'trump-21',
            'trump-22'
        ])
    })

    it('runs each block from high to low when asked, keeping the blocks in place', () => {
        expect(sortHand(hand, true)).toEqual([
            'hearts-K',
            'hearts-1',
            'hearts-4',
            'spades-K',
            'spades-10',
            'spades-7',
            'trump-22',
            'trump-21',
            'trump-1'
        ])
    })
})
