import { describe, expect, it } from 'vitest'
import { dealOrder } from './dealAnimator.js'

describe('the deal', () => {
    it('gives a packet to each player from the dealer’s right, the talon, then each player again', () => {
        expect(dealOrder(['a', 'b', 'c', 'd'], 'b')).toEqual([
            'c',
            'd',
            'a',
            'b',
            'talon',
            'c',
            'd',
            'a',
            'b'
        ])
    })
})
