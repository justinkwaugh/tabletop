// Rulebook 6.0 and 6.1, transcribed from the module's "Chart Combat and Raid"
// (`notes/vassal-charts.md`).

interface CombatRow {
    // The highest combat value of the row.
    upTo: number
    // Hits for a modified roll of 3 or less, 4, 5, … 11, and 12 or more.
    hits: readonly number[]
}

const COMBAT_TABLE: readonly CombatRow[] = [
    { upTo: 2, hits: [0, 1, 1, 1, 1, 1, 1, 2, 2, 2] },
    { upTo: 4, hits: [1, 1, 1, 1, 1, 2, 2, 2, 3, 3] },
    { upTo: 6, hits: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4] },
    { upTo: 8, hits: [1, 2, 2, 2, 3, 3, 4, 4, 5, 5] },
    { upTo: 10, hits: [2, 3, 3, 3, 4, 4, 5, 5, 6, 6] },
    { upTo: 12, hits: [3, 3, 4, 4, 4, 5, 5, 6, 7, 7] },
    { upTo: 15, hits: [4, 4, 4, 5, 5, 6, 6, 7, 8, 8] },
    { upTo: 18, hits: [4, 4, 5, 6, 6, 7, 8, 8, 9, 9] },
    { upTo: 21, hits: [5, 5, 6, 7, 7, 7, 8, 9, 10, 10] },
    { upTo: 24, hits: [5, 5, 6, 7, 7, 8, 9, 10, 10, 11] },
    { upTo: 27, hits: [6, 6, 6, 7, 8, 8, 10, 11, 11, 12] },
    { upTo: 30, hits: [6, 6, 7, 8, 9, 9, 11, 12, 12, 13] },
    { upTo: 34, hits: [7, 7, 8, 9, 10, 10, 12, 13, 13, 15] },
    { upTo: 38, hits: [8, 9, 9, 10, 10, 11, 13, 14, 14, 16] },
    { upTo: 42, hits: [9, 10, 10, 11, 11, 12, 14, 15, 16, 18] },
    { upTo: 47, hits: [9, 10, 11, 12, 12, 13, 15, 16, 17, 19] },
    { upTo: 53, hits: [10, 11, 12, 12, 13, 14, 16, 17, 18, 20] },
    { upTo: 60, hits: [11, 12, 13, 14, 15, 16, 17, 18, 20, 22] },
    { upTo: 69, hits: [13, 14, 15, 16, 17, 18, 19, 21, 22, 24] },
    { upTo: Number.POSITIVE_INFINITY, hits: [15, 16, 17, 18, 19, 20, 21, 22, 23, 25] }
]

const LOWEST_COLUMN_ROLL = 3

// A side with no combat value deals no hits.
export function combatHits(combatValue: number, roll: number): number {
    if (combatValue <= 0) {
        return 0
    }
    const row = COMBAT_TABLE.find((candidate) => combatValue <= candidate.upTo)
    if (!row) {
        throw new Error(`No combat table row for ${combatValue}`)
    }
    const column = Math.min(row.hits.length - 1, Math.max(0, roll - LOWEST_COLUMN_ROLL))
    return row.hits[column]
}

export enum RaidResult {
    StealCash = 'StealCash',
    StealMoreCash = 'StealMoreCash',
    StealMarker = 'StealMarker',
    TakeGood = 'TakeGood',
    DestroySettlement = 'DestroySettlement'
}

// From the lowest result to the highest, each for two faces of the die.
export const RAID_RESULTS: readonly RaidResult[] = [
    RaidResult.StealCash,
    RaidResult.StealMoreCash,
    RaidResult.StealMarker,
    RaidResult.TakeGood,
    RaidResult.DestroySettlement
]

export function raidResult(roll: number): RaidResult {
    const index = Math.min(RAID_RESULTS.length - 1, Math.max(0, Math.ceil(roll / 2) - 1))
    return RAID_RESULTS[index]
}

// The raider's damage from the percentile roll: 1 at 25% or less (20% for a fast ship), 2 at
// 10% or less.
export const RAID_DAMAGE_CHANCE = 25
export const FAST_RAID_DAMAGE_CHANCE = 20
export const RAID_HEAVY_DAMAGE_CHANCE = 10

export function raidDamage(percentile: number, fast: boolean): number {
    if (percentile <= RAID_HEAVY_DAMAGE_CHANCE) {
        return 2
    }
    return percentile <= (fast ? FAST_RAID_DAMAGE_CHANCE : RAID_DAMAGE_CHANCE) ? 1 : 0
}
