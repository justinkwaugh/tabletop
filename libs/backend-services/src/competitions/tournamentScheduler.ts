import { createHash } from 'node:crypto'
import {
    getPrng,
    shuffle,
    tournamentTableId,
    type Tournament,
    type TournamentSchedule,
    type TournamentScheduleQuality,
    type RandomFunction
} from '@tabletop/common'
import { TournamentError } from './tournamentError.js'

export function generateTournamentSchedule(
    tournament: Tournament,
    seed: number
): TournamentSchedule {
    const { entrants } = tournament
    const stage = tournament.stages[0]
    if (!stage || tournament.status !== 'locked')
        throw new TournamentError('The roster must be locked before scheduling')
    const { tableSize, concurrency } = tournament.rules
    const gamesPerEntrant = tournament.format.stages[0].gamesPerEntrant
    const entrantIds = entrants.map((entrant) => entrant.userId).sort()
    const count = entrantIds.length
    if (count < tableSize)
        throw new TournamentError(`At least ${tableSize} players are needed for a full table`, 400)
    if (count > 256 || new Set(entrantIds).size !== count)
        throw new TournamentError('The locked roster is invalid', 400)
    if ((count * gamesPerEntrant) % tableSize !== 0)
        throw new TournamentError(
            `${count} players × ${gamesPerEntrant} games cannot fill ${tableSize}-player tables. Change the games per player before publishing.`,
            400
        )
    if (gamesPerEntrant % tableSize !== 0)
        throw new TournamentError(
            `Equal starting positions require games per player to be a multiple of ${tableSize}`,
            400
        )
    const random = getPrng(seed)
    shuffle(entrantIds, random)
    const tableCount = (count * gamesPerEntrant) / tableSize
    const attempts = Math.max(
        1,
        Math.min(96, Math.floor(4_000_000 / (tableCount * tableSize * tableSize)))
    )
    let best: { tables: number[][]; quality: TournamentScheduleQuality } | undefined
    const preset = presetOffsets(count, tableSize, gamesPerEntrant)
    for (let attempt = 0; attempt < (preset ? 1 : attempts); attempt++) {
        const tables: number[][] = []
        for (let block = 0; block < gamesPerEntrant / tableSize; block++) {
            const offsets = Array.from({ length: count }, (_, index) => index)
            if (attempt > 0) shuffle(offsets, random)
            const selected = preset?.[block] ?? offsets.slice(0, tableSize)
            for (let shift = 0; shift < count; shift++)
                tables.push(selected.map((offset) => (offset + shift) % count))
        }
        if (!preset && attempt === 1 && count === 8 && tableSize === 4 && gamesPerEntrant === 4) {
            tables.splice(
                0,
                tables.length,
                ...['ACEG', 'BDFH', 'EABF', 'CGHD', 'DBAC', 'FHGE', 'GFDA', 'HECB'].map((row) =>
                    [...row].map((letter) => letter.charCodeAt(0) - 65)
                )
            )
        }
        const candidate = assessTables(tables, count, concurrency, random)
        if (!best || compareQuality(candidate.quality, best.quality) < 0) best = candidate
    }
    if (!best) throw new Error('Schedule search produced no candidate')
    const schedule: TournamentSchedule = {
        id: '',
        version: 1,
        seed,
        tournamentId: tournament.id,
        stageId: stage.id,
        rosterRevision: stage.rosterRevision,
        entrantIds,
        tableSize,
        gamesPerEntrant,
        concurrency,
        quality: best.quality,
        tables: best.tables.map((table, index) => ({
            id: tournamentTableId(index),
            entrantIds: table.map((index) => entrantIds[index])
        }))
    }
    schedule.id = createHash('sha256').update(JSON.stringify(schedule)).digest('hex')
    return schedule
}

function presetOffsets(count: number, size: number, games: number): number[][] | undefined {
    if (count === 5 && size === 2 && games === 4)
        return [
            [0, 1],
            [0, 2]
        ]
    if (count === 7 && size === 3 && games === 3) return [[0, 1, 3]]
    if (count === 7 && size === 4 && games === 4) return [[0, 1, 2, 4]]
    if (count === 11 && size === 5 && games === 5) return [[0, 2, 3, 4, 8]]
    return undefined
}

export function assessTables(
    tables: number[][],
    entrantCount: number,
    concurrency: number,
    random: RandomFunction
) {
    const pairs = Array.from({ length: entrantCount }, () => new Uint16Array(entrantCount))
    const memberships = new Set<string>()
    for (const table of tables) {
        memberships.add([...table].sort((a, b) => a - b).join(','))
        for (let first = 0; first < table.length; first++) {
            for (let second = first + 1; second < table.length; second++) {
                const a = Math.min(table[first], table[second])
                const b = Math.max(table[first], table[second])
                pairs[a][b]++
            }
        }
    }
    const histogram = new Map<number, number>()
    for (let a = 0; a < entrantCount; a++) {
        for (let b = a + 1; b < entrantCount; b++)
            histogram.set(pairs[a][b], (histogram.get(pairs[a][b]) ?? 0) + 1)
    }
    const opening = findOpening(tables, entrantCount, concurrency, random)
    const selected = new Set(opening.indices)
    return {
        tables: [
            ...opening.indices.map((index) => tables[index]),
            ...tables.filter((_, index) => !selected.has(index))
        ],
        quality: {
            opponentCounts: [...histogram]
                .sort(([a], [b]) => a - b)
                .map(([games, pairs]) => ({ games, pairs })),
            repeatedTables: tables.length - memberships.size,
            openingTables: opening.indices.length,
            openingEntrants: opening.coverage
        }
    }
}

function findOpening(
    tables: number[][],
    count: number,
    concurrency: number,
    random: RandomFunction
) {
    const size = tables[0].length
    const attempts = Math.max(1, Math.min(12, Math.floor(100_000 / (tables.length * size * size))))
    const order = tables.map((_, index) => index)
    let best = { indices: new Array<number>(), coverage: 0 }
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) shuffle(order, random)
        const loads = new Uint16Array(count)
        const selected = new Set<number>()
        for (let newPlayers = size; newPlayers >= 0; newPlayers--) {
            for (const index of order) {
                if (selected.has(index)) continue
                const table = tables[index]
                if (table.some((entrant) => loads[entrant] >= concurrency)) continue
                if (table.filter((entrant) => loads[entrant] === 0).length < newPlayers) continue
                selected.add(index)
                for (const entrant of table) loads[entrant]++
            }
        }
        const coverage = loads.filter((load) => load > 0).length
        if (
            coverage > best.coverage ||
            (coverage === best.coverage && selected.size > best.indices.length)
        )
            best = { indices: [...selected], coverage }
    }
    return best
}

function compareQuality(a: TournamentScheduleQuality, b: TournamentScheduleQuality) {
    const pairCost = (quality: TournamentScheduleQuality) =>
        quality.opponentCounts.reduce((sum, { games, pairs }) => sum + games * games * pairs, 0)
    return (
        b.openingEntrants - a.openingEntrants ||
        b.openingTables - a.openingTables ||
        a.repeatedTables - b.repeatedTables ||
        pairCost(a) - pairCost(b)
    )
}
