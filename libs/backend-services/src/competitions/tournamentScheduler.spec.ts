import { describe, expect, it } from 'vitest'
import { getPrng, tournamentScheduleParticipation } from '@tabletop/common'
import { assessTables, generateTournamentSchedule } from './tournamentScheduler.js'
import type { Tournament } from '@tabletop/common'

function registration(count: number, size: number, games = size, concurrency = 1): Tournament {
    return {
        id: 'event',
        name: 'Mini',
        description: '',
        organizerId: 'admin',
        status: 'locked',
        revision: 10,
        createdAt: 1,
        updatedAt: 2,
        rules: {
            titleId: 'test',
            tableSize: size,
            concurrency,
            gameConfig: {},
            scoring: 'splitWinsV1',
            registration: { kind: 'whenFull', capacity: count }
        },
        format: { kind: 'mini', stages: [{ id: 'main', name: 'Main', gamesPerEntrant: games }] },
        stages: [
            {
                id: 'main',
                status: 'awaitingSchedule',
                rosterRevision: 10,
                createdAt: 2
            }
        ],
        entrants: Array.from({ length: count }, (_, i) => ({ userId: `player-${i}`, joinedAt: 1 }))
    }
}

function verifySchedule(count: number, size: number, games: number, concurrency: number) {
    const input = registration(count, size, games, concurrency)
    const schedule = generateTournamentSchedule(input, 1234)
    expect(schedule.tables).toHaveLength((count * games) / size)
    expect(new Set(schedule.tables.map((table) => table.id)).size).toBe(schedule.tables.length)
    for (const table of schedule.tables) expect(new Set(table.entrantIds).size).toBe(size)
    const players = tournamentScheduleParticipation(schedule)
    expect(players).toHaveLength(count)
    for (const player of players) {
        expect(player.games).toBe(games)
        expect(player.positions).toEqual(Array(size).fill(games / size))
    }
    const opening = schedule.tables.slice(0, schedule.quality.openingTables)
    const loads = new Map<string, number>()
    for (const table of opening)
        for (const id of table.entrantIds) loads.set(id, (loads.get(id) ?? 0) + 1)
    expect(Math.max(...loads.values())).toBeLessThanOrEqual(concurrency)
    expect(loads.size).toBe(schedule.quality.openingEntrants)
    expect(
        generateTournamentSchedule({ ...input, entrants: [...input.entrants].reverse() }, 1234)
    ).toEqual(schedule)
    return schedule
}

describe('balanced tournament scheduling', () => {
    it.each([
        [5, 2, 4, 1],
        [7, 3, 3, 1],
        [7, 4, 4, 2],
        [11, 5, 5, 2]
    ])(
        'uses the exact default design for %i entrants, %i seats',
        (count, size, games, pairGames) => {
            const schedule = verifySchedule(count, size, games, 1)
            expect(schedule.quality.opponentCounts).toEqual([
                { games: pairGames, pairs: (count * (count - 1)) / 2 }
            ])
            expect(schedule.quality.repeatedTables).toBe(0)
        }
    )
    it.each([6, 7, 8, 9, 10, 16, 23, 32])(
        'balances %i entrants across table sizes and concurrency limits',
        (count) => {
            for (const size of [2, 3, 4, 5])
                for (const concurrency of [1, 2]) verifySchedule(count, size, size, concurrency)
        }
    )
    it('balances repeated blocks and changes assignments with the seed', () => {
        verifySchedule(10, 4, 12, 3)
        expect(generateTournamentSchedule(registration(7, 4), 1).tables).not.toEqual(
            generateTournamentSchedule(registration(7, 4), 2).tables
        )
    })
    it('keeps good opponent balance separate from opening capacity', () => {
        const overlapping = Array.from({ length: 8 }, (_, shift) =>
            [0, 1, 2, 4].map((offset) => (offset + shift) % 8)
        )
        const quality = assessTables(overlapping, 8, 1, getPrng(1)).quality
        expect(quality.opponentCounts.map((value) => value.games)).toEqual([1, 2])
        expect(quality.openingTables).toBe(1)
        expect(quality.openingEntrants).toBe(4)
        const schedule = verifySchedule(8, 4, 4, 1)
        expect(schedule.quality.openingTables).toBe(2)
        expect(schedule.quality.openingEntrants).toBe(8)
        expect(schedule.quality.opponentCounts.map((value) => value.games)).toEqual([0, 2])
    })
    it('explains infeasible rosters, divisibility, and position counts', () => {
        expect(() => generateTournamentSchedule(registration(3, 4), 1)).toThrow('At least 4')
        expect(() => generateTournamentSchedule(registration(7, 4, 3), 1)).toThrow('cannot fill')
        expect(() => generateTournamentSchedule(registration(8, 4, 3), 1)).toThrow('multiple of 4')
        const unlocked = registration(7, 4)
        unlocked.status = 'open'
        expect(() => generateTournamentSchedule(unlocked, 1)).toThrow('roster must be locked')
    })
    it('completes maximum supported workloads within a bounded search', () => {
        const start = performance.now()
        for (const size of [2, 16]) {
            const schedule = generateTournamentSchedule(registration(256, size, 256, 256), 42)
            expect(schedule.tables).toHaveLength((256 * 256) / size)
            expect(schedule.quality.openingEntrants).toBe(256)
            expect(schedule.quality.openingTables).toBe(schedule.tables.length)
            for (const player of tournamentScheduleParticipation(schedule)) {
                expect(player.games).toBe(256)
                expect(player.positions).toEqual(Array(size).fill(256 / size))
            }
        }
        expect(performance.now() - start).toBeLessThan(5000)
    })
})
