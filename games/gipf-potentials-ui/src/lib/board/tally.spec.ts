import { describe, expect, it } from 'vitest'
import { tallyStacks } from './tally.js'

describe('tallyStacks', () => {
    it('stands the first taken at the right, filling each stack before the next', () => {
        expect(tallyStacks([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[7], [4, 5, 6], [1, 2, 3]])
    })

    it('draws nothing when nothing is taken', () => {
        expect(tallyStacks([])).toEqual([])
    })
})
