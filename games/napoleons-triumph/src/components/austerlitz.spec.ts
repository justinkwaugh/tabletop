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

    it('gives cavalry on the map only one road by which to attack a locale from another', () => {
        const roads = new Map<string, Set<string>>()
        for (const start of AUSTERLITZ.localeIds) {
            for (const path of AUSTERLITZ.roadPathsFrom(start)) {
                const attackLocale = path[path.length - 1]
                for (const { to } of AUSTERLITZ.roadLinksFrom(attackLocale)) {
                    if (AUSTERLITZ.traceRoad({ locale: start }, [...path, to]).length > 0) {
                        const attack = `${start} from ${attackLocale} into ${to}`
                        roads.set(attack, (roads.get(attack) ?? new Set()).add(path.join()))
                    }
                }
            }
        }
        expect(roads.size).toBeGreaterThan(0)
        expect([...roads.values()].filter((ways) => ways.size > 1)).toEqual([])
    })

    it('has, where entry roads meet in a locale, one that leaves cavalry attacking from it every road the others do', () => {
        const roadsBeyond = (entryId: string, locale: number, into: number) =>
            AUSTERLITZ.traceRoad({ entryId }, [locale, into]).map(
                (arrival) => `${arrival.group}${arrival.main ? ' main' : ''}`
            )
        const entries = [...AUSTERLITZ.entries(Side.French), ...AUSTERLITZ.entries(Side.Allied)]
        const meetings = entries.flatMap((entry) =>
            AUSTERLITZ.roadLinksFrom(entry.locale).map((link) =>
                entries
                    .filter((other) => other.locale === entry.locale)
                    .map((other) => roadsBeyond(other.id, entry.locale, link.to))
                    .filter((roads) => roads.length > 0)
            )
        )
        const contested = meetings.filter((roads) => roads.length > 1)
        expect(contested.length).toBeGreaterThan(0)
        for (const roads of contested) {
            expect(
                roads.some((open) => roads.every((other) => other.every((r) => open.includes(r))))
            ).toBe(true)
        }
    })

    it('carries the main road three locales and a local road two', () => {
        expect(
            AUSTERLITZ.traceRoad({ locale: 51 }, [38, 52, 53]).some((arrival) => arrival.main)
        ).toBe(true)
        expect(AUSTERLITZ.traceRoad({ locale: 88 }, [99])).not.toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ locale: 51 }, [38, 52, 61])).toHaveLength(0)
    })

    it('reaches nowhere along a road path longer than the main road reach', () => {
        const backAndForth = Array.from({ length: 600_000 }, (_, step) =>
            step % 2 === 0 ? 38 : 51
        )
        expect(AUSTERLITZ.traceRoad({ locale: 51 }, backAndForth)).toHaveLength(0)
    })

    it('keeps apart two roads of a locale that join only beyond its border', () => {
        // Pratze Berg: the road from Liechtenstein's locale and the road cutting its corner from 94 meet in 121.
        expect(AUSTERLITZ.traceRoad({ locale: 123 }, [106, 94])).toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ locale: 123 }, [106, 121])).not.toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ locale: 94 }, [106, 121])).not.toHaveLength(0)
        // Locale 90: the roads from 101 and from 80 cross in 102.
        expect(AUSTERLITZ.traceRoad({ locale: 101 }, [90, 80])).toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ locale: 101 }, [90, 102])).not.toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ locale: 80 }, [90, 102])).not.toHaveLength(0)
    })

    it('does not join entry roads that meet only under a printed track', () => {
        expect(AUSTERLITZ.traceRoad({ entryId: 'F10' }, [140, 131])).not.toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ entryId: 'F11' }, [140, 147])).not.toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ entryId: 'F11' }, [140, 131])).toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ entryId: 'F10' }, [140, 147])).toHaveLength(0)
        expect(AUSTERLITZ.traceRoad({ locale: 147 }, [140, 131])).toHaveLength(0)
    })
})
