// Shared sizing/row-splitting for the dealt politics-card row - PoliticsPileReveal (which
// actually lays the cards out) and PoliticsDeckChooser (which needs to know, before any of that
// exists, exactly where the leftmost dealt card will land so its own leftover-deck placeholder
// can slide to just beside it) both need to agree on these, or the two drift apart.

// Same fixed size PlayerState uses for the cards in a player's own hand - the LARGEST a card
// here ever gets; see responsiveCardWidth below for why it isn't the only size.
export const CARD_W = 66
export const CARD_H = Math.round((CARD_W * 832) / 534)
export const CARD_GAP = 8 // px, matches gap-2

// Below this width, a card stops shrinking any further and rows start piling up instead - card
// art/numerals stop being legible past this point.
const MIN_CARD_W = 44

// Never shrink cards further than the point where this many still fit in one row - a pile of
// several cards read as visually dense on a phone (multiple rows of small cards stacked with
// little room around them) even though the row-wrap math below never let any of them actually
// overflow. Letting the cards themselves shrink, the same technique PoliticsHand's own
// min(150px, 42vw) uses for its cards, both leaves more breathing room per row and fits more
// cards in the rows that do form, so a pile needs fewer of them.
const MIN_CARDS_PER_ROW = 4

// The card width to actually use for a row this wide - CARD_W whenever the row is wide enough
// for MIN_CARDS_PER_ROW cards at that size already (desktop, most tablets: unchanged from
// before), shrinking only on a row too narrow for that many, down to MIN_CARD_W. Unlike
// PoliticsHand's viewport-relative vw unit, this is relative to the row's own REAL measured
// width (already needed for the wrap math below anyway), which is exact rather than an
// approximation of how much of the viewport this row actually gets.
export function responsiveCardWidth(availableWidth: number): number {
    if (availableWidth <= 0) return CARD_W
    const idealForMinPerRow = (availableWidth - (MIN_CARDS_PER_ROW - 1) * CARD_GAP) / MIN_CARDS_PER_ROW
    return Math.max(MIN_CARD_W, Math.min(CARD_W, idealForMinPerRow))
}

// How many cards actually fit across one row at the row's real measured width, at the given card
// width - a plain flex-wrap left it up to the browser, which packs each row as full as it can
// before wrapping (5 cards at 4-per-row read as 4 then 1, not 3 and 2). Falls back to
// "everything fits" before the real width is known.
export function cardsPerRow(availableWidth: number, totalCount: number, cardWidth: number = CARD_W): number {
    return availableWidth > 0
        ? Math.max(1, Math.floor((availableWidth + CARD_GAP) / (cardWidth + CARD_GAP)))
        : totalCount
}

// Splits a pile into as many rows as it actually needs (per cardsPerRow above), sized as evenly
// as possible rather than greedily - 5 cards needing 2 rows come out 3/2, not 4/1.
export function rowSizes(totalCount: number, availableWidth: number, cardWidth: number = CARD_W): number[] {
    if (totalCount <= 0) return []
    const perRow = cardsPerRow(availableWidth, totalCount, cardWidth)
    const rowCount = Math.max(1, Math.ceil(totalCount / perRow))
    const base = Math.floor(totalCount / rowCount)
    const remainder = totalCount % rowCount
    return Array.from({ length: rowCount }, (_, r) => base + (r < remainder ? 1 : 0))
}

// The pixel width of a row of `count` cards laid out flat with CARD_GAP between them, at the
// given card width - what justify-center centers within the row's own available width.
export function rowContentWidth(count: number, cardWidth: number = CARD_W): number {
    return count > 0 ? count * cardWidth + (count - 1) * CARD_GAP : 0
}
