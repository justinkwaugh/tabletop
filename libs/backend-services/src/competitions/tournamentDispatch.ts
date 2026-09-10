import { type Tournament, type TournamentSchedule, type TournamentDispatch } from '@tabletop/common'

export function reserveTournamentTables(
    tournament: Tournament,
    schedule: TournamentSchedule,
    dispatch: TournamentDispatch
): string[] {
    const allocated = new Set([...dispatch.active, ...dispatch.reserved])
    const finished = new Set(dispatch.finished)
    const counts = new Map<string, number>()
    for (const table of schedule.tables) {
        if (!allocated.has(table.id)) continue
        for (const id of table.entrantIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    const reserved = [...dispatch.reserved]
    for (const table of schedule.tables) {
        if (allocated.has(table.id) || finished.has(table.id)) continue
        if (!table.entrantIds.every((id) => (counts.get(id) ?? 0) < tournament.rules.concurrency))
            continue
        reserved.push(table.id)
        for (const id of table.entrantIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return reserved
}
