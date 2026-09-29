import { Color } from '@tabletop/common'
import type { WarbandCounts } from '../model/warbandCounts.js'
import { parseEnumValue } from '../data/typedData.js'

export function warbandEntries(counts: Readonly<WarbandCounts>): [Color, number][] {
    const entries: [Color, number][] = []
    for (const [key, count] of Object.entries(counts)) {
        if (count === undefined) continue
        entries.push([parseEnumValue(Object.values(Color), key, `${key} is not a colour`), count])
    }
    return entries
}

export function totalWarbands(counts: Readonly<WarbandCounts>): number {
    return warbandEntries(counts).reduce((sum, [, n]) => sum + n, 0)
}

/** Warband records are sparse: a colour with no entry has none there. */
export function countOf(counts: Readonly<WarbandCounts>, color: Color): number {
    return counts[color] ?? 0
}

export function adjustCount(counts: WarbandCounts, color: Color, delta: number): void {
    counts[color] = countOf(counts, color) + delta
}
