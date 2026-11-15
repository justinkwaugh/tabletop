import { edificeName, type ChronicleBuilt } from '@tabletop/oath'
import { cardName } from '$lib/model/names.js'

// The record's entry as the Chronicle tab and a History record row lay it out: only what happened.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-22" (UTC, as the table record keeps it) as "22 Oct 2026". */
export function entryDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number)
    return `${day} ${MONTHS[month - 1]} ${year}`
}

/** R-8.3.1 — "Sprawling Rampart at Plains", or "Repaired the Great Spire at Steppe". */
export function builtWords(built: ChronicleBuilt): string {
    const at = built.siteCardId ? ` at ${cardName(built.siteCardId)}` : ''
    const edifice = edificeName(built.edificeId, false)
    return built.repaired ? `Repaired the ${edifice}${at}` : `${edifice}${at}`
}

/** R-8.3.3 — the edifices ruined, by their intact names. */
export function ruinedWords(edificeIds: readonly string[]): string[] {
    return edificeIds.map((edificeId) => edificeName(edificeId, false))
}
