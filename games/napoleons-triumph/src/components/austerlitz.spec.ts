import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from './austerlitz.js'
import { Star } from './battleMap.js'
import { Side } from './pieces.js'

const locales = (star: Star) => AUSTERLITZ.localesWithStar(star).map((locale) => locale.id)

describe('the Austerlitz map, as checked against the public map file', () => {
    it('has 168 locales joined by 281 passable and 12 impassable approaches', () => {
        expect(AUSTERLITZ.localeIds).toHaveLength(168)
        const sides = AUSTERLITZ.allApproaches
        expect(sides.filter((side) => !side.impassable)).toHaveLength(281 * 2)
        expect(sides.filter((side) => side.impassable)).toHaveLength(12 * 2)
    })

    it('marks the objectives, Welspitz among the three-star locales', () => {
        expect(locales(Star.Blue)).toHaveLength(13)
        expect(locales(Star.Red)).toEqual([84, 86, 87, 88, 97, 99, 112, 113, 115, 126, 128])
        expect(locales(Star.Green)).toEqual([58, 59, 67, 68, 87, 88, 99, 115, 128])
        expect(locales(Star.Black)).toEqual([87, 88, 96, 99, 106, 108, 112, 115, 121, 126, 128])
    })

    it('has thirteen French and seven Allied entry roads, three of them main roads', () => {
        expect(AUSTERLITZ.entries(Side.French)).toHaveLength(13)
        expect(AUSTERLITZ.entries(Side.Allied)).toHaveLength(7)
        expect(AUSTERLITZ.entryLocales(Side.French)).toContain(139)
        const main = [
            ...AUSTERLITZ.entries(Side.French),
            ...AUSTERLITZ.entries(Side.Allied)
        ].filter((entry) => entry.main)
        expect(main.map((entry) => entry.locale).toSorted((a, b) => a - b)).toEqual([51, 59, 87])
    })

    it('treats locales parted by a stream with a bar on each bank as not adjacent', () => {
        expect(AUSTERLITZ.adjacentLocales(114)).not.toContain(115)
        expect(AUSTERLITZ.adjacentLocales(124)).not.toContain(151)
        expect(AUSTERLITZ.adjacentLocales(58)).toContain(78)
        expect(AUSTERLITZ.reachableNeighbours(58)).not.toContain(78)
    })

    it('carries the main road three locales and a local road two', () => {
        expect(AUSTERLITZ.traceRoad(51, [38, 52, 53]).some((arrival) => arrival.main)).toBe(true)
        expect(AUSTERLITZ.traceRoad(88, [99])).not.toHaveLength(0)
        expect(AUSTERLITZ.traceRoad(51, [38, 52, 61])).toHaveLength(0)
    })
})
