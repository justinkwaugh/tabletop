/**
 * R-11.10 the Great Slum, Crop Rotation, R-5.1.4.I the People's Favor — the "Discard first" row of a site play. From
 * revision 32 each power that gives a card discarded first gives one, so the row takes one pick per power; with one
 * power (and before revision 32) it takes one, and tapping another card replaces it.
 */

import type { HydratedOathGameState } from '@tabletop/oath'

/** The cards some power lets the play discard first, in map order, and how many may go (`discardFirstReach`). */
export type DiscardFirstReach = { cardIds: readonly string[]; most: number }

/**
 * The cards the row judges: where several may go, those the powers reach; where one may go, every denizen on the
 * map, each judged by the engine as before (before revision 16 it accepted any for Salt the Earth's own play).
 */
export function rowReach(
    state: HydratedOathGameState,
    reach: DiscardFirstReach
): DiscardFirstReach {
    if (reach.most > 1) return reach
    return { cardIds: state.allSiteIds().flatMap((siteId) => state.denizensAt(siteId)), most: 1 }
}

/** The engine's judgement of the play with these cards discarded first. */
export type OpensWith = (firsts: readonly string[]) => boolean

export interface DiscardFirstRow {
    /** The cards shown: those picked, and each that can still be added so the play can be completed. */
    offered: string[]
    /** The cards picked that can still go together, in the order picked. */
    picked: string[]
    /** More than one may go: a tap adds a card or takes it back. Otherwise a tap replaces the pick. */
    several: boolean
}

/**
 * Some set of the reached cards, holding `firsts` and at most `most` in all, that the engine accepts: the play can be
 * completed from these picks. Cards are added in map order after the last one added, so each set is tried once.
 */
function completable(
    reach: DiscardFirstReach,
    opens: OpensWith,
    firsts: readonly string[],
    from = 0
): boolean {
    if (firsts.length > reach.most) return false
    if (opens(firsts)) return true
    if (firsts.length === reach.most) return false
    return reach.cardIds.some(
        (cardId, index) =>
            index >= from &&
            !firsts.includes(cardId) &&
            completable(reach, opens, [...firsts, cardId], index + 1)
    )
}

/** The play is open with no card discarded first, or with some the reached cards allow. */
export function opensWithSomeFirsts(reach: DiscardFirstReach, opens: OpensWith): boolean {
    return completable(reach, opens, [])
}

/** The row for the picks `wanted`, as the engine judges each set of cards discarded first. */
export function discardFirstRow(
    reach: DiscardFirstReach,
    wanted: readonly string[],
    opens: OpensWith
): DiscardFirstRow {
    if (reach.most <= 1) {
        // One card: each that opens the play on its own, as the engine accepts it.
        const offered = reach.cardIds.filter((cardId) => opens([cardId]))
        const [pick] = wanted
        return {
            offered,
            picked: pick !== undefined && offered.includes(pick) ? [pick] : [],
            several: false
        }
    }
    const picked: string[] = []
    for (const cardId of wanted) {
        if (
            reach.cardIds.includes(cardId) &&
            !picked.includes(cardId) &&
            completable(reach, opens, [...picked, cardId])
        ) {
            picked.push(cardId)
        }
    }
    const offered = reach.cardIds.filter(
        (cardId) => picked.includes(cardId) || completable(reach, opens, [...picked, cardId])
    )
    return { offered, picked, several: true }
}

/** A tap on a card in the row: taken back if picked; otherwise added, or, where one may go, in place of the pick. */
export function tapDiscardFirst(row: DiscardFirstRow, cardId: string): string[] {
    if (row.picked.includes(cardId)) return row.picked.filter((id) => id !== cardId)
    if (!row.offered.includes(cardId)) return row.picked
    return row.several ? [...row.picked, cardId] : [cardId]
}

/** The cards discarded first as an action sends them: one card as before, two or more as a list. */
export function discardFirstFields(firsts: readonly string[]): {
    discardFirstCardId?: string
    discardFirstCardIds?: string[]
} {
    if (firsts.length === 0) return {}
    return firsts.length === 1
        ? { discardFirstCardId: firsts[0] }
        : { discardFirstCardIds: [...firsts] }
}
