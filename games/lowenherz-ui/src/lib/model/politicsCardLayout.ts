// Shared sizing/row-splitting for the dealt politics-card row - PoliticsPileReveal (which
// actually lays the cards out) and PoliticsDeckChooser (which needs to know, before any of that
// exists, exactly where the leftmost dealt card will land so its own leftover-deck placeholder
// can slide to just beside it) both need to agree on these, or the two drift apart.

// Same fixed size PlayerState uses for the cards in a player's own hand.
export const CARD_W = 66
export const CARD_H = Math.round((CARD_W * 832) / 534)
export const CARD_GAP = 8 // px, matches gap-2

// How many cards actually fit across one row at the row's real measured width - a plain
// flex-wrap left it up to the browser, which packs each row as full as it can before wrapping (5
// cards at 4-per-row read as 4 then 1, not 3 and 2). Falls back to "everything fits" before the
// real width is known.
export function cardsPerRow(availableWidth: number, totalCount: number): number {
    return availableWidth > 0
        ? Math.max(1, Math.floor((availableWidth + CARD_GAP) / (CARD_W + CARD_GAP)))
        : totalCount
}

// Splits a pile into as many rows as it actually needs (per cardsPerRow above), sized as evenly
// as possible rather than greedily - 5 cards needing 2 rows come out 3/2, not 4/1.
export function rowSizes(totalCount: number, availableWidth: number): number[] {
    if (totalCount <= 0) return []
    const perRow = cardsPerRow(availableWidth, totalCount)
    const rowCount = Math.max(1, Math.ceil(totalCount / perRow))
    const base = Math.floor(totalCount / rowCount)
    const remainder = totalCount % rowCount
    return Array.from({ length: rowCount }, (_, r) => base + (r < remainder ? 1 : 0))
}

// The pixel width of a row of `count` cards laid out flat with CARD_GAP between them - what
// justify-center centers within the row's own available width.
export function rowContentWidth(count: number): number {
    return count > 0 ? count * CARD_W + (count - 1) * CARD_GAP : 0
}
