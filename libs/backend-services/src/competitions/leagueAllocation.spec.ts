import { describe, expect, it } from 'vitest'
import {
    leagueGroupsAtLevel,
    assertExists,
    leagueGroupName,
    leagueGroupSizesFor,
    leagueMinimumEntrants,
    type LeagueShape,
    type LeagueGroupSizes
} from '@tabletop/common'
import {
    leagueFinalAllocation,
    leagueHeldPlaces,
    leagueLayout,
    leagueSeasonPlacements,
    leagueSeedingAllocation,
    leagueSeedingPlacements,
    type LeagueGroupResult
} from './leagueAllocation.js'

const sevens: LeagueGroupSizes = { groupSize: 7, bottomMinimum: 5, bottomMaximum: 11 }

function group(groupId: string, level: number, scores: number[]): LeagueGroupResult {
    return {
        groupId,
        level,
        standings: scores.map((score, index) => ({ userId: `${groupId}-${index + 1}`, score })),
        tables: []
    }
}

function season(shape: LeagueShape, groupsPerLevel: number[], size = 7): LeagueGroupResult[] {
    return groupsPerLevel.flatMap((count, level) =>
        Array.from({ length: count }, (_, index) =>
            group(
                leagueGroupName(shape, level, index),
                level,
                Array.from({ length: size }, (_, place) => size - place)
            )
        )
    )
}

function moved(results: ReturnType<typeof leagueSeasonPlacements>, movement: string) {
    return results
        .filter((placement) => placement.movement === movement)
        .map((placement) => placement.userId)
        .sort()
}

describe('leagueLayout', () => {
    it.each([
        ['ladder', 13, undefined],
        ['ladder', 14, [[7], [7]]],
        ['ladder', 18, [[7], [11]]],
        ['ladder', 19, [[7], [7], [5]]],
        ['ladder', 20, [[7], [7], [6]]],
        ['pyramid', 20, undefined],
        ['pyramid', 21, [[7], [7, 7]]],
        ['pyramid', 25, [[7], [9, 9]]],
        ['pyramid', 29, [[7], [11, 11]]],
        ['pyramid', 30, [[7], [7, 7], [9]]],
        ['pyramid', 35, [[7], [7, 7], [7, 7]]]
    ] as const)('%s with %i entrants', (shape, count, expected) => {
        expect(leagueLayout(shape, sevens, count)).toEqual(expected)
    })

    it('sizes Groups from the Mini preset for each table size', () => {
        expect(leagueGroupSizesFor(2)).toEqual({ groupSize: 5, bottomMinimum: 3, bottomMaximum: 7 })
        expect(leagueGroupSizesFor(3)).toEqual(sevens)
        expect(leagueGroupSizesFor(4)).toEqual(sevens)
        expect(leagueGroupSizesFor(5)).toEqual({
            groupSize: 11,
            bottomMinimum: 9,
            bottomMaximum: 19
        })
        expect(leagueGroupSizesFor(6)).toBeUndefined()
    })

    it.each(
        (['ladder', 'pyramid'] as const).flatMap((shape) =>
            [2, 3, 4, 5].map((tableSize) => [shape, tableSize] as const)
        )
    )(
        'places every %s field of %i-player tables from the minimum, with full upper Levels',
        (shape, tableSize) => {
            const sizes = leagueGroupSizesFor(tableSize)
            assertExists(sizes)
            for (let count = leagueMinimumEntrants(shape, sizes); count <= 600; count++) {
                const layout = leagueLayout(shape, sizes, count)
                expect(layout, `${count} entrants`).toBeDefined()
                if (!layout) continue
                const bottom = layout[layout.length - 1]
                expect(layout.flat().reduce((sum, size) => sum + size, 0)).toBe(count)
                layout
                    .slice(0, -1)
                    .forEach((groupSizes, level) =>
                        expect(groupSizes).toEqual(
                            Array.from(
                                { length: leagueGroupsAtLevel(shape, level) },
                                () => sizes.groupSize
                            )
                        )
                    )
                expect(bottom.length).toBeLessThanOrEqual(
                    leagueGroupsAtLevel(shape, layout.length - 1)
                )
                for (const size of bottom) {
                    expect(size).toBeGreaterThanOrEqual(sizes.bottomMinimum)
                    expect(size).toBeLessThanOrEqual(sizes.bottomMaximum)
                }
            }
        }
    )
})

describe('leagueSeasonPlacements', () => {
    it('promotes the top two and relegates the bottom two of each Ladder Group', () => {
        const results = leagueSeasonPlacements('ladder', season('ladder', [1, 1, 1]), 1)
        expect(moved(results, 'promoted')).toEqual(['B-1', 'B-2', 'C-1', 'C-2'])
        expect(moved(results, 'relegated')).toEqual(['A-6', 'A-7', 'B-6', 'B-7'])
    })

    it('promotes each Pyramid Group winner and relegates the bottom two', () => {
        const results = leagueSeasonPlacements('pyramid', season('pyramid', [1, 2, 4]), 1)
        expect(moved(results, 'promoted')).toEqual(
            ['B1-1', 'B2-1', 'C1-1', 'C2-1', 'C3-1', 'C4-1'].sort()
        )
        expect(moved(results, 'relegated')).toEqual(
            ['A-6', 'A-7', 'B1-6', 'B1-7', 'B2-6', 'B2-7'].sort()
        )
    })

    it('promotes the top two of a lone Bottom Level Group and relegates only two from above', () => {
        const groups = season('pyramid', [1, 2, 1])
        groups[1].standings[6].score = 0
        const results = leagueSeasonPlacements('pyramid', groups, 1)
        expect(moved(results, 'promoted')).toEqual(['B1-1', 'B2-1', 'C1-1', 'C1-2'].sort())
        expect(moved(results, 'relegated')).toEqual(['A-6', 'A-7', 'B1-7', 'B2-7'].sort())
    })

    it('caps an unfilled Bottom Level at what the Level above relegates, winners first', () => {
        const groups = season('pyramid', [1, 2, 3])
        groups[5].standings[1].score = 6.5
        const results = leagueSeasonPlacements('pyramid', groups, 1)
        expect(moved(results, 'promoted').filter((userId) => userId.startsWith('C'))).toEqual(
            ['C1-1', 'C2-1', 'C3-1', 'C3-2'].sort()
        )
        expect(moved(results, 'relegated').filter((userId) => userId.startsWith('B'))).toEqual(
            ['B1-6', 'B1-7', 'B2-6', 'B2-7'].sort()
        )
    })

    it('breaks a Cutoff Tie by tiebreak, then head-to-head, then a seeded draw', () => {
        const tied = (tiebreaks: (number | undefined)[], winners: string[]) => {
            const groups = season('ladder', [1, 1])
            const b = groups[1]
            b.standings[2].score = 6
            b.standings[1].tiebreak = tiebreaks[0]
            b.standings[2].tiebreak = tiebreaks[1]
            b.tables = [{ entrantIds: ['B-2', 'B-3', 'B-4', 'B-5'], winnerIds: winners }]
            return groups
        }
        const promotedFromB = (groups: LeagueGroupResult[], seed: number) =>
            moved(leagueSeasonPlacements('ladder', groups, seed), 'promoted')

        expect(promotedFromB(tied([10, 20], []), 1)).toEqual(['B-1', 'B-3'])
        expect(promotedFromB(tied([undefined, undefined], ['B-3']), 1)).toEqual(['B-1', 'B-3'])
        expect(promotedFromB(tied([undefined, undefined], ['B-2', 'B-3']), 1)).toHaveLength(2)
        const draws = new Set(
            Array.from({ length: 20 }, (_, seed) =>
                promotedFromB(tied([undefined, undefined], []), seed).join()
            )
        )
        expect(draws).toEqual(new Set(['B-1,B-2', 'B-1,B-3']))
        expect(promotedFromB(tied([undefined, undefined], []), 7)).toEqual(
            promotedFromB(tied([undefined, undefined], []), 7)
        )
    })
})

describe('leagueFinalAllocation', () => {
    const lastSeason = leagueHeldPlaces(
        leagueSeasonPlacements('ladder', season('ladder', [1, 1, 1]), 1)
    )

    it('orders Held Places by Level, keeping those who played the Level ahead of arrivals', () => {
        expect(
            lastSeason.filter((place) => place.level === 1).map((place) => place.userId)
        ).toEqual(['B-3', 'B-4', 'B-5', 'C-1', 'C-2', 'A-6', 'A-7'])
    })

    it('keeps confirmed Held Places at their Level and starts new Entrants at the Bottom Level', () => {
        const groups = leagueFinalAllocation({
            shape: 'ladder',
            sizes: sevens,
            confirmed: lastSeason,
            newEntrantIds: ['new-1', 'new-2'],
            seed: 3
        })
        expect(groups?.map((value) => [value.groupId, value.entrantIds.length])).toEqual([
            ['A', 7],
            ['B', 7],
            ['C', 9]
        ])
        expect(groups?.[0].entrantIds.sort()).toEqual(
            ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2'].sort()
        )
        expect(groups?.[2].entrantIds).toEqual(expect.arrayContaining(['new-1', 'new-2']))
    })

    it('fills a Vacancy from the best of those who played the Level below, cascading down', () => {
        const groups = leagueFinalAllocation({
            shape: 'ladder',
            sizes: sevens,
            confirmed: lastSeason.filter((place) => place.userId !== 'A-1'),
            newEntrantIds: ['new-1'],
            seed: 3
        })
        expect(groups?.[0].entrantIds).toContain('B-3')
        expect(groups?.[1].entrantIds).toContain('C-3')
        expect(groups?.[2].entrantIds).toContain('new-1')
    })

    it('moves the lowest returning Entrants of a full Bottom Level into a new Level', () => {
        const bottom = Array.from({ length: 11 }, (_, index) => ({
            userId: `c-${index}`,
            level: 2
        }))
        const groups = leagueFinalAllocation({
            shape: 'ladder',
            sizes: sevens,
            confirmed: [...lastSeason.filter((place) => place.level < 2), ...bottom],
            newEntrantIds: ['new-1', 'new-2', 'new-3'],
            seed: 3
        })
        expect(groups?.map((value) => [value.groupId, value.entrantIds.length])).toEqual([
            ['A', 7],
            ['B', 7],
            ['C', 7],
            ['D', 7]
        ])
        expect(groups?.[2].entrantIds.sort()).toEqual(
            bottom
                .slice(0, 7)
                .map((p) => p.userId)
                .sort()
        )
        expect(groups?.[3].entrantIds).toEqual(
            expect.arrayContaining([...bottom.slice(7).map((p) => p.userId), 'new-1'])
        )
    })

    it('keeps those relegated into the Bottom Level there when a new Level is added', () => {
        const stayed = Array.from({ length: 8 }, (_, index) => ({
            userId: `c-${index}`,
            level: 2
        }))
        const relegated = ['b-6', 'b-7'].map((userId) => ({
            userId,
            level: 2,
            relegated: true as const
        }))
        const groups = leagueFinalAllocation({
            shape: 'ladder',
            sizes: sevens,
            confirmed: [...lastSeason.filter((place) => place.level < 2), ...stayed, ...relegated],
            newEntrantIds: Array.from({ length: 4 }, (_, index) => `new-${index}`),
            seed: 3
        })
        expect(groups?.map((value) => value.entrantIds.length)).toEqual([7, 7, 7, 7])
        expect(groups?.[2].entrantIds.sort()).toEqual(
            ['c-0', 'c-1', 'c-2', 'c-3', 'c-4', 'b-6', 'b-7'].sort()
        )
        expect(groups?.[3].entrantIds).toEqual(expect.arrayContaining(['c-5', 'c-6', 'c-7']))
    })

    it('holds a Bottom Level place for a Substitute and none for the place they finished', () => {
        const placements = leagueSeasonPlacements(
            'ladder',
            season('ladder', [1, 1, 1]).map((group) =>
                group.groupId === 'B'
                    ? {
                          ...group,
                          standings: group.standings.map((row) =>
                              row.userId === 'B-1' ? { ...row, playedBy: 'sub' } : row
                          )
                      }
                    : group
            ),
            1
        )
        expect(placements.find((placement) => placement.userId === 'B-1')).toMatchObject({
            movement: 'promoted',
            substituteId: 'sub'
        })
        const held = leagueHeldPlaces(placements)
        expect(held.find((place) => place.userId === 'B-1')).toBeUndefined()
        expect(held.at(-1)).toEqual({ userId: 'sub', level: 2 })
        expect(held.filter((place) => place.level === 0)).toHaveLength(6)
    })

    it('keeps a Substitute to the place they earned in another Group', () => {
        const placements = leagueSeasonPlacements(
            'ladder',
            season('ladder', [1, 1, 1]).map((group) =>
                group.groupId === 'A'
                    ? {
                          ...group,
                          standings: group.standings.map((row) =>
                              row.userId === 'A-3' ? { ...row, playedBy: 'C-1' } : row
                          )
                      }
                    : group
            ),
            1
        )
        const held = leagueHeldPlaces(placements).filter((place) => place.userId === 'C-1')
        expect(held).toEqual([{ userId: 'C-1', level: 1 }])
    })

    it('marks Held Places reached by relegation', () => {
        expect(lastSeason.filter((place) => place.relegated).map((place) => place.userId)).toEqual([
            'A-6',
            'A-7',
            'B-6',
            'B-7'
        ])
    })

    it('lets new Entrants fill upper Levels when too few returning Entrants confirm', () => {
        const groups = leagueFinalAllocation({
            shape: 'ladder',
            sizes: sevens,
            confirmed: lastSeason.slice(0, 3),
            newEntrantIds: Array.from({ length: 11 }, (_, index) => `new-${index}`),
            seed: 3
        })
        expect(groups?.map((value) => value.entrantIds.length)).toEqual([7, 7])
        expect(groups?.[0].entrantIds).toEqual(
            expect.arrayContaining(lastSeason.slice(0, 3).map((place) => place.userId))
        )
        expect(groups?.[0].entrantIds.filter((id) => id.startsWith('new-'))).toHaveLength(4)
    })

    it('seeds a first Season at random, reproducibly from its seed', () => {
        const entrants = Array.from({ length: 30 }, (_, index) => `user-${index}`)
        const allocate = (seed: number) =>
            leagueFinalAllocation({
                shape: 'pyramid',
                sizes: sevens,
                confirmed: [],
                newEntrantIds: entrants,
                seed
            })
        const first = allocate(5)
        expect(first?.map((value) => [value.groupId, value.entrantIds.length])).toEqual([
            ['A', 7],
            ['B1', 7],
            ['B2', 7],
            ['C1', 9]
        ])
        expect(new Set(first?.flatMap((value) => value.entrantIds)).size).toBe(30)
        expect(allocate(5)).toEqual(first)
        expect(allocate(6)).not.toEqual(first)
    })

    it('does not start below two full Levels', () => {
        expect(
            leagueFinalAllocation({
                shape: 'pyramid',
                sizes: sevens,
                confirmed: [],
                newEntrantIds: Array.from({ length: 20 }, (_, index) => `user-${index}`),
                seed: 1
            })
        ).toBeUndefined()
    })
})

describe('Season 0 seeding', () => {
    const entrants = (count: number) => Array.from({ length: count }, (_, index) => `user-${index}`)

    it('draws everyone into random groups of about 7 at one level', () => {
        const allocate = (count: number, seed = 1) =>
            leagueSeedingAllocation({
                shape: 'pyramid',
                sizes: sevens,
                entrantIds: entrants(count),
                seed
            })
        expect(allocate(20)).toBeUndefined()
        expect(
            allocate(21)?.map((value) => [value.groupId, value.level, value.entrantIds.length])
        ).toEqual([
            ['1', 0, 7],
            ['2', 0, 7],
            ['3', 0, 7]
        ])
        expect(allocate(30)?.map((value) => value.entrantIds.length)).toEqual([8, 8, 7, 7])
        expect(allocate(30)).toEqual(allocate(30))
        expect(allocate(30, 2)).not.toEqual(allocate(30))
        expect(new Set(allocate(30)?.flatMap((value) => value.entrantIds)).size).toBe(30)
    })

    it('ranks across groups by place, then points, and fills Levels from the top', () => {
        const groups = [
            group('1', 0, [7, 6, 5, 4, 3, 2, 1]),
            group('2', 0, [7, 6, 4, 4, 3, 2, 1]),
            group('3', 0, [7, 6, 4.5, 4, 3, 2, 1])
        ]
        const placements = leagueSeedingPlacements('pyramid', sevens, groups, 1)
        expect(placements.every((placement) => placement.movement === 'seeded')).toBe(true)
        expect(
            placements
                .filter((placement) => placement.nextLevel === 0)
                .map((placement) => placement.userId)
                .sort()
        ).toEqual(['1-1', '1-2', '1-3', '2-1', '2-2', '3-1', '3-2'])
        expect(placements.filter((placement) => placement.nextLevel === 1)).toHaveLength(14)
        const held = leagueHeldPlaces(placements)
        expect(held.slice(0, 7).every((place) => place.level === 0)).toBe(true)
        expect(held[7]).toEqual({ userId: '3-3', level: 1 })
    })
})
