import { describe, expect, it } from 'vitest'
import { compareBids, hasLegalBid } from './bids.js'

function ranked(bids: Record<string, number[]>): string[] {
    return Object.entries(bids)
        .toSorted(([, a], [, b]) => compareBids(b, a))
        .map(([player]) => player)
}

describe('compareBids', () => {
    // Designer's answers relayed in BGG thread 658791.
    it.each([
        [{ A: [3, 3], B: [3, 3, 6], C: [4, 4], D: [8] }, ['C', 'B', 'A', 'D']],
        [{ A: [0], B: [5, 0], C: [4, 1], D: [5] }, ['B', 'D', 'C', 'A']],
        [{ A: [4, 2, 2], B: [4, 3, 1], C: [5, 3], D: [8] }, ['A', 'D', 'C', 'B']],
        [{ A: [3, 2], B: [7, 0], C: [5, 2], D: [4, 3] }, ['B', 'C', 'D', 'A']]
    ])('orders %j as the designer did', (bids, order) => {
        expect(ranked(bids)).toEqual(order)
    })

    it('follows the rulebook examples', () => {
        expect(ranked({ A: [7], B: [3, 4], C: [4], D: [2, 2] })).toEqual(['D', 'A', 'B', 'C'])
        expect(compareBids([0, 0], [8])).toBeGreaterThan(0)
        expect(compareBids([0, 0, 0], [8, 8])).toBeGreaterThan(0)
        expect(compareBids([0], [])).toBeGreaterThan(0)
    })
})

describe('hasLegalBid', () => {
    it('is false only when every possible bid repeats an earlier one', () => {
        expect(hasLegalBid([5], [[5]])).toBe(false)
        expect(hasLegalBid([5, 5], [[5], [5, 5]])).toBe(false)
        expect(hasLegalBid([5, 0], [[5], [0]])).toBe(true)
        expect(hasLegalBid([], [])).toBe(false)
    })
})
