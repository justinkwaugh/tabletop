import { describe, expect, it } from 'vitest'
import { WayStepKind, traceWays, type Way } from './ways.js'

describe('choosing among the ways to a place', () => {
    const byTheNorth: Way = { road: [39, 53] }
    const byTheSouth: Way = { road: [52, 53] }

    it('asks nothing when only one way leads there', () => {
        expect(traceWays([byTheNorth], [])).toEqual({ settled: byTheNorth, next: [] })
    })

    it('offers the locales where two ways part, and a tap on one settles it', () => {
        const ways = [byTheNorth, byTheSouth]
        expect(traceWays(ways, []).next).toEqual([
            { kind: WayStepKind.Locale, key: 'locale:39', locale: 39 },
            { kind: WayStepKind.Locale, key: 'locale:52', locale: 52 }
        ])
        expect(traceWays(ways, ['locale:52'])).toEqual({ settled: byTheSouth, next: [] })
    })

    it('takes the steps the ways share by itself and asks where they part', () => {
        const short: Way = { road: [39, 53] }
        const long: Way = { road: [39, 40, 53] }
        expect(traceWays([short, long], []).next.map((step) => step.locale)).toEqual([53, 40])
        expect(traceWays([short, long], ['locale:53']).settled).toBe(short)
        expect(traceWays([short, long], ['locale:40']).settled).toBe(long)
    })

    it('asks again when a tap leaves more than one way', () => {
        const ways: Way[] = [{ road: [39, 53] }, { road: [52, 61, 53] }, { road: [52, 62, 53] }]
        expect(traceWays(ways, ['locale:52']).next.map((step) => step.locale)).toEqual([61, 62])
        expect(traceWays(ways, ['locale:52', 'locale:62']).settled).toBe(ways[2])
    })

    it('tells roads that come on in one locale apart by their entry', () => {
        const ways: Way[] = [
            { entryId: 'F5', road: [89] },
            { entryId: 'F6', road: [89] }
        ]
        expect(traceWays(ways, []).next).toEqual([
            { kind: WayStepKind.Entry, key: 'entry:F5', locale: 89, entryId: 'F5' },
            { kind: WayStepKind.Entry, key: 'entry:F6', locale: 89, entryId: 'F6' }
        ])
        expect(traceWays(ways, ['entry:F6']).settled).toBe(ways[1])
    })
})
