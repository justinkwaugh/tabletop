import {
    type Tournament,
    type TournamentSchedule,
    type TournamentDispatch,
    type TournamentTable
} from '@tabletop/common'

export function reserveTournamentTables(
    tournament: Tournament,
    schedule: TournamentSchedule,
    dispatch: TournamentDispatch
): string[] {
    const allocated = new Set([...dispatch.active, ...dispatch.reserved])
    const finished = new Set([...dispatch.finished, ...(dispatch.voided ?? [])])
    const withdrawn = new Set(
        tournament.entrants.filter((entrant) => entrant.withdrawn).map((entrant) => entrant.userId)
    )
    const counts = entrantTableCounts(schedule.tables, [...allocated])
    const reserved = [...dispatch.reserved]
    for (const table of schedule.tables) {
        if (allocated.has(table.id) || finished.has(table.id)) continue
        if (table.entrantIds.some((id) => withdrawn.has(id))) continue
        if (!table.entrantIds.every((id) => (counts.get(id) ?? 0) < tournament.rules.concurrency))
            continue
        reserved.push(table.id)
        for (const id of table.entrantIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return reserved
}

/** How many of the given Tables each Entrant sits at. */
export function entrantTableCounts(
    tables: Pick<TournamentTable, 'id' | 'entrantIds'>[],
    tableIds: string[]
): Map<string, number> {
    const selected = new Set(tableIds)
    const counts = new Map<string, number>()
    for (const table of tables) {
        if (!selected.has(table.id)) continue
        for (const id of table.entrantIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
}
