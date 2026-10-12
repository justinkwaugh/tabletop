import { IMPERIAL_WARBANDS, type WarbandCounts, type WarbandOwner } from '../model/warbandCounts.js'

export function warbandEntries(counts: Readonly<WarbandCounts>): [WarbandOwner, number][] {
    const entries: [WarbandOwner, number][] = []
    for (const [owner, count] of Object.entries(counts)) {
        if (count === undefined) continue
        entries.push([owner, count])
    }
    return entries
}

export function totalWarbands(counts: Readonly<WarbandCounts>): number {
    return warbandEntries(counts).reduce((sum, [, n]) => sum + n, 0)
}

/** Warband records are sparse: an owner with no entry has none there. */
export function countOf(counts: Readonly<WarbandCounts>, owner: WarbandOwner): number {
    return counts[owner] ?? 0
}

export function adjustCount(counts: WarbandCounts, owner: WarbandOwner, delta: number): void {
    counts[owner] = countOf(counts, owner) + delta
}

export function countedWarbands(count: number): string {
    return `${count} ${count === 1 ? 'warband' : 'warbands'}`
}

export function describeWarbands(count: number, owner: WarbandOwner): string {
    if (owner === IMPERIAL_WARBANDS)
        return `${count} Imperial ${count === 1 ? 'warband' : 'warbands'}`
    return `${count} of ${owner}'s warbands`
}

export function soleOwnerOf(counts: Readonly<WarbandCounts>): WarbandOwner | undefined {
    const owners = warbandEntries(counts).filter(([, count]) => count > 0)
    return owners.length === 1 ? owners[0][0] : undefined
}

export function ownerIfAny(count: number, owner: WarbandOwner): WarbandOwner | undefined {
    return count > 0 ? owner : undefined
}
