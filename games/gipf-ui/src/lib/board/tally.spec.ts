import { describe, expect, it } from 'vitest'
import { tallyStacks } from './tally.js'

describe('tallyStacks', () => {
    it('stacks pieces in full stacks, with what is left over last', () => {
        expect(tallyStacks(14, 3)).toEqual([3, 3, 3, 3, 2])
        expect(tallyStacks(18, 4)).toEqual([4, 4, 4, 4, 2])
    })

    it('draws nothing for no pieces', () => {
        expect(tallyStacks(0)).toEqual([])
    })
})
