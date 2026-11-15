import { describe, expect, it } from 'vitest'
import { Prng } from '../game/components/prng.js'
import { CommonSubsequence } from './commonSubsequence.js'

function longestLength(left: readonly number[], right: readonly number[]): number {
    const lengths = Array.from({ length: left.length + 1 }, () =>
        new Array<number>(right.length + 1).fill(0)
    )
    for (let leftAt = left.length - 1; leftAt >= 0; leftAt--) {
        for (let rightAt = right.length - 1; rightAt >= 0; rightAt--) {
            lengths[leftAt][rightAt] =
                left[leftAt] === right[rightAt]
                    ? lengths[leftAt + 1][rightAt + 1] + 1
                    : Math.max(lengths[leftAt + 1][rightAt], lengths[leftAt][rightAt + 1])
        }
    }
    return lengths[0][0]
}

function expectLongestCommonSubsequence(left: readonly number[], right: readonly number[]) {
    const pairs = CommonSubsequence.between(left, right, Infinity)
    expect(pairs).toHaveLength(longestLength(left, right))
    let lastLeft = -1
    let lastRight = -1
    for (const [leftAt, rightAt] of pairs ?? []) {
        expect(leftAt).toBeGreaterThan(lastLeft)
        expect(rightAt).toBeGreaterThan(lastRight)
        expect(left[leftAt]).toBe(right[rightAt])
        lastLeft = leftAt
        lastRight = rightAt
    }
}

describe('CommonSubsequence', () => {
    it('pairs what a queue keeps when its head leaves and a new tail joins', () => {
        expect(CommonSubsequence.between([1, 2, 3, 4], [2, 3, 4, 5], Infinity)).toEqual([
            [1, 0],
            [2, 1],
            [3, 2]
        ])
    })

    it('pairs nothing when either side is empty or nothing is shared', () => {
        expect(CommonSubsequence.between([], [], Infinity)).toEqual([])
        expect(CommonSubsequence.between([1, 2], [], Infinity)).toEqual([])
        expect(CommonSubsequence.between([], [1, 2], Infinity)).toEqual([])
        expect(CommonSubsequence.between([1, 2], [3, 4, 5], Infinity)).toEqual([])
    })

    it('pairs every element of equal sides', () => {
        expect(CommonSubsequence.between([7, 7, 8], [7, 7, 8], Infinity)).toEqual([
            [0, 0],
            [1, 1],
            [2, 2]
        ])
    })

    it.each([1, 2, 3, 4])('finds a longest subsequence of short random sides %i', (seed) => {
        const random = new Prng({ seed, invocations: 0 })
        for (let run = 0; run < 3000; run++) {
            const values = 1 + random.randInt(6)
            const side = () =>
                Array.from({ length: random.randInt(9) }, () => random.randInt(values))
            expectLongestCommonSubsequence(side(), side())
        }
    })

    it.each([1, 2, 3, 4])('finds a longest subsequence of an edited long side %i', (seed) => {
        const random = new Prng({ seed, invocations: 0 })
        for (let run = 0; run < 100; run++) {
            const left = Array.from({ length: random.randInt(150) }, () => random.randInt(40))
            const right = [...left]
            for (let edits = random.randInt(8); edits > 0; edits--) {
                right.splice(
                    random.randInt(right.length + 1),
                    random.randInt(3),
                    ...Array.from({ length: random.randInt(3) }, () => random.randInt(40))
                )
            }
            expectLongestCommonSubsequence(left, right)
        }
    })

    it('gives up once the search has done the work it was allowed', () => {
        const left = Array.from({ length: 400 }, (_, index) => index)
        const right = Array.from({ length: 400 }, (_, index) => (index % 2 ? index : -index - 1))
        expect(CommonSubsequence.between(left, right, 500)).toBeUndefined()
        expect(CommonSubsequence.between(left, right, Infinity)).toHaveLength(200)
    })
})
