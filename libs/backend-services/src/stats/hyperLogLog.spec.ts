import { describe, expect, it } from 'vitest'
import { countDistinct, sketchOf } from './hyperLogLog.js'

const users = (count: number, prefix = 'user') =>
    Array.from({ length: count }, (_, index) => `${prefix}-${index}`)

describe('distinct sketches', () => {
    it('counts small sets exactly from their hashes', () => {
        for (const count of [0, 1, 7, 40, 150, 512]) {
            const sketch = sketchOf(users(count))
            expect('hashes' in sketch).toBe(true)
            expect(countDistinct([sketch])).toBe(count)
        }
    })

    it('counts a value seen on several days once', () => {
        const monday = sketchOf(['a', 'b', 'c'])
        const tuesday = sketchOf(['b', 'c', 'd'])
        expect(countDistinct([monday, tuesday])).toBe(4)
    })

    it('stays within two percent for large sets stored densely', () => {
        const sketch = sketchOf(users(20_000))
        expect('registers' in sketch).toBe(true)
        expect(Math.abs(countDistinct([sketch]) - 20_000) / 20_000).toBeLessThan(0.02)
    })

    it('merges sparse and dense sketches', () => {
        const large = sketchOf(users(5_000))
        const small = sketchOf(users(50, 'other'))
        expect(Math.abs(countDistinct([large, small]) - 5_050) / 5_050).toBeLessThan(0.02)
    })
})
