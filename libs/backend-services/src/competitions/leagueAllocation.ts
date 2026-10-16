import {
    assertExists,
    getPrng,
    leagueGroupName,
    leagueGroupsAtLevel,
    leagueMinimumEntrants,
    shuffle,
    type LeagueGroupSizes,
    type LeagueHeldPlace,
    type LeagueAllocatedGroup,
    type LeagueSeasonPlacement,
    type LeagueShape,
    type TournamentScore
} from '@tabletop/common'
import { compareTournamentScores } from './tournamentScoring.js'

export interface LeagueGroupResult {
    groupId: string
    level: number
    standings: (Pick<TournamentScore, 'score' | 'tiebreak'> & { userId: string })[]
    tables: { entrantIds: string[]; winnerIds: string[] }[]
}

export function leagueLayout(
    shape: LeagueShape,
    sizes: LeagueGroupSizes,
    entrantCount: number
): number[][] | undefined {
    if (entrantCount < leagueMinimumEntrants(shape, sizes)) return undefined
    const upper: number[][] = []
    let remaining = entrantCount
    for (let level = 0; remaining > 0; level++) {
        const groups = leagueGroupsAtLevel(shape, level)
        const count = fittingGroupCount(remaining, sizes, groups)
        if (level > 0 && count !== undefined) return [...upper, evenSizes(remaining, count)]
        upper.push(Array.from({ length: groups }, () => sizes.groupSize))
        remaining -= groups * sizes.groupSize
    }
    return undefined
}

export function leagueSeasonPlacements(
    shape: LeagueShape,
    groups: LeagueGroupResult[],
    seed: number
): LeagueSeasonPlacement[] {
    const levels = rankedLevels(groups, seed)
    for (let level = 1; level < levels.length; level++) {
        const count = promotions(shape, groupCount(groups, level - 1), groupCount(groups, level))
        for (const placement of levels[level].slice(0, count)) {
            placement.movement = 'promoted'
            placement.nextLevel = level - 1
        }
        for (const placement of levels[level - 1].slice(-count)) {
            placement.movement = 'relegated'
            placement.nextLevel = level
        }
    }
    return levels.flat()
}

export function leagueSeedingPlacements(
    shape: LeagueShape,
    sizes: LeagueGroupSizes,
    groups: LeagueGroupResult[],
    seed: number
): LeagueSeasonPlacement[] {
    const ranked = rankedLevels(groups, seed).flat()
    const layout = leagueLayout(shape, sizes, ranked.length)
    assertExists(layout, 'A seeding season needs enough players for two full levels')
    splitByLevel(ranked, layout).forEach((placements, level) => {
        for (const placement of placements) {
            placement.movement = 'seeded'
            placement.nextLevel = level
        }
    })
    return ranked
}

export function leagueSeedingAllocation({
    shape,
    sizes,
    entrantIds,
    seed
}: {
    shape: LeagueShape
    sizes: LeagueGroupSizes
    entrantIds: string[]
    seed: number
}): LeagueAllocatedGroup[] | undefined {
    if (entrantIds.length < leagueMinimumEntrants(shape, sizes)) return undefined
    const count = fittingGroupCount(entrantIds.length, sizes, entrantIds.length)
    assertExists(count, 'Two full levels always fit into seeding groups')
    const entrants = [...entrantIds]
    shuffle(entrants, getPrng(seed))
    return splitBySizes(entrants, evenSizes(entrants.length, count)).map(
        (groupEntrants, index) => ({
            groupId: String(index + 1),
            level: 0,
            entrantIds: groupEntrants
        })
    )
}

export function leagueHeldPlaces(placements: LeagueSeasonPlacement[]): LeagueHeldPlace[] {
    const arrival = (placement: LeagueSeasonPlacement) =>
        placement.nextLevel === placement.level ? 0 : placement.nextLevel < placement.level ? 1 : 2
    return placements
        .map((placement, order) => ({ placement, order }))
        .sort(
            (a, b) =>
                a.placement.nextLevel - b.placement.nextLevel ||
                arrival(a.placement) - arrival(b.placement) ||
                a.order - b.order
        )
        .map(({ placement }) => ({ userId: placement.userId, level: placement.nextLevel }))
}

export function leagueFinalAllocation({
    shape,
    sizes,
    confirmed,
    newEntrantIds,
    seed
}: {
    shape: LeagueShape
    sizes: LeagueGroupSizes
    confirmed: LeagueHeldPlace[]
    newEntrantIds: string[]
    seed: number
}): LeagueAllocatedGroup[] | undefined {
    const random = getPrng(seed)
    const newcomers = [...newEntrantIds]
    shuffle(newcomers, random)
    const ordered = [
        ...confirmed
            .map((place, order) => ({ place, order }))
            .sort((a, b) => a.place.level - b.place.level || a.order - b.order)
            .map(({ place }) => place.userId),
        ...newcomers
    ]
    const layout = leagueLayout(shape, sizes, ordered.length)
    if (!layout) return undefined
    return splitByLevel(ordered, layout).flatMap((entrants, level) => {
        shuffle(entrants, random)
        return splitBySizes(entrants, layout[level]).map((entrantIds, index) => ({
            groupId: leagueGroupName(shape, level, index),
            level,
            entrantIds
        }))
    })
}

function rankedLevels(groups: LeagueGroupResult[], seed: number): LeagueSeasonPlacement[][] {
    const draw = drawOrder(
        groups.flatMap((group) => group.standings.map((row) => row.userId)),
        seed
    )
    const levels: LeagueSeasonPlacement[][] = []
    const scores = new Map<string, LeagueGroupResult['standings'][number]>()
    for (const group of groups) {
        for (const row of group.standings) scores.set(row.userId, row)
        const placements = (levels[group.level] ??= [])
        groupPlaces(group, draw).forEach((userId, index) =>
            placements.push({
                userId,
                groupId: group.groupId,
                level: group.level,
                place: index + 1,
                movement: 'stayed',
                nextLevel: group.level
            })
        )
    }
    const crossGroup = (a: LeagueSeasonPlacement, b: LeagueSeasonPlacement) =>
        a.place - b.place ||
        compareTournamentScores(entry(scores, a.userId), entry(scores, b.userId)) ||
        entry(draw, a.userId) - entry(draw, b.userId)
    for (const placements of levels) placements.sort(crossGroup)
    return levels
}

function fittingGroupCount(
    total: number,
    sizes: LeagueGroupSizes,
    limit: number
): number | undefined {
    const fewest = Math.ceil(total / sizes.bottomMaximum)
    const most = Math.min(limit, Math.floor(total / sizes.bottomMinimum))
    if (fewest > most) return undefined
    return Math.min(most, Math.max(fewest, Math.round(total / sizes.groupSize)))
}

function promotions(shape: LeagueShape, groupsAbove: number, groups: number): number {
    if (shape === 'ladder') return 2 * groups
    return groups === 2 * groupsAbove ? groups : Math.min(2 * groups, 2 * groupsAbove)
}

function groupCount(groups: LeagueGroupResult[], level: number): number {
    return groups.filter((group) => group.level === level).length
}

function groupPlaces(group: LeagueGroupResult, draw: Map<string, number>): string[] {
    const rows = [...group.standings].sort(compareTournamentScores)
    const places: string[] = []
    for (let start = 0; start < rows.length;) {
        let end = start + 1
        while (end < rows.length && compareTournamentScores(rows[start], rows[end]) === 0) end++
        const tied = rows.slice(start, end).map((row) => row.userId)
        const headToHead = headToHeadScores(group.tables, tied)
        places.push(
            ...tied.sort(
                (a, b) =>
                    entry(headToHead, b) - entry(headToHead, a) || entry(draw, a) - entry(draw, b)
            )
        )
        start = end
    }
    return places
}

function headToHeadScores(
    tables: LeagueGroupResult['tables'],
    tied: string[]
): Map<string, number> {
    const scores = new Map(tied.map((userId) => [userId, 0]))
    if (tied.length < 2) return scores
    const scale = tables.reduce((value, table) => lcm(value, table.winnerIds.length || 1), 1)
    for (const table of tables) {
        if (table.entrantIds.filter((userId) => scores.has(userId)).length < 2) continue
        for (const winner of table.winnerIds)
            if (scores.has(winner))
                scores.set(winner, entry(scores, winner) + scale / table.winnerIds.length)
    }
    return scores
}

function drawOrder(userIds: string[], seed: number): Map<string, number> {
    const order = [...userIds].sort()
    shuffle(order, getPrng(seed, 1))
    return new Map(order.map((userId, index) => [userId, index]))
}

function entry<T>(map: Map<string, T>, userId: string): T {
    const value = map.get(userId)
    assertExists(value, `No league standing for ${userId}`)
    return value
}

function splitBySizes<T>(items: T[], sizes: number[]): T[][] {
    let taken = 0
    return sizes.map((size) => {
        const part = items.slice(taken, taken + size)
        taken += size
        return part
    })
}

function splitByLevel<T>(items: T[], layout: number[][]): T[][] {
    return splitBySizes(
        items,
        layout.map((sizes) => sizes.reduce((sum, size) => sum + size, 0))
    )
}

function evenSizes(total: number, count: number): number[] {
    return Array.from(
        { length: count },
        (_, index) => Math.floor(total / count) + (index < total % count ? 1 : 0)
    )
}

function lcm(a: number, b: number): number {
    const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y))
    return (a * b) / gcd(a, b)
}
