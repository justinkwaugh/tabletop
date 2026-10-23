import type { CagePlacement } from '@tabletop/oath'

// R-10.13-H1 — the Obsidian Cage sent down: its Imperial warbands, so many per Imperial board.

/** The step's question, as Fae Merchant's and Relic Hunter's Cage steps both ask it. */
export function cageQuestion(total: number): string {
    return total === 1
        ? 'Obsidian Cage: where does its 1 purple warband go?'
        : `Obsidian Cage: where do its ${total} purple warbands go?`
}

/**
 * The most a row may hold. With two boards a row may take them all, the other row holding the
 * rest; with more, a row takes what the other rows leave.
 */
export function cageCeilingAt(counts: readonly number[], row: number, total: number): number {
    if (counts.length <= 2) return total
    const others = counts.reduce((sum, count, index) => (index === row ? sum : sum + count), 0)
    return Math.max(0, total - others)
}

/**
 * The rows after a row is set to `count`. With two boards the other row takes the rest, so the
 * rows always total `total`; with more, nothing else changes.
 */
export function cageCountsAfterTap(
    counts: readonly number[],
    row: number,
    count: number,
    total: number
): number[] {
    const set = Math.min(Math.max(0, count), cageCeilingAt(counts, row, total))
    if (counts.length === 2) return counts.map((_, index) => (index === row ? set : total - set))
    return counts.map((held, index) => (index === row ? set : held))
}

/** The answer's placement: each board given at least one, in the rows' order. */
export function cagePlacementOf(
    boards: readonly string[],
    counts: readonly number[]
): CagePlacement {
    return boards
        .map((playerId, index) => ({ playerId, count: counts[index] ?? 0 }))
        .filter(({ count }) => count > 0)
}
