import { describe, expect, it } from 'vitest'
import { Suit } from '@tabletop/oath'
import { suitImage, suitImageKeys } from './suitImages.js'

/** R-2.1.3 — every favor bank is chosen by its suit's symbol. */
describe('suit symbols', () => {
    it('every suit has a symbol, each its own', () => {
        const images = Object.values(Suit).map((suit) => suitImage(suit))
        expect(new Set(images).size).toBe(Object.values(Suit).length)
    })

    it('no symbol is orphaned — every file names a suit', () => {
        const known = new Set<string>(Object.values(Suit))
        expect(suitImageKeys().filter((key) => !known.has(key))).toEqual([])
    })
})
