import { describe, expect, it } from 'vitest'
import { tallyStacks } from './tally.js'

describe('tallyStacks', () => {
    it('stacks pieces in full stacks, with what is left over first', () => {
        expect(tallyStacks(14, 3)).toEqual([2, 3, 3, 3, 3])
        expect(tallyStacks(18, 4)).toEqual([2, 4, 4, 4, 4])
        expect(tallyStacks(9, 3)).toEqual([3, 3, 3])
    })

    it('draws nothing for no pieces', () => {
        expect(tallyStacks(0)).toEqual([])
    })
})
