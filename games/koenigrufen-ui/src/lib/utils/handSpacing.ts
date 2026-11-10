// How much of a card shows when it is opened: most of it, so its picture as well as its corner
// index can be seen.
export const ExposedShare = 0.8

// The left margin of each card in a one-row hand of `count` cards `cardWidth` wide across `room`.
// Once they no longer fit side by side they overlap evenly. The `exposed` card then shows at least
// `ExposedShare` of its width, and the cards around it close up evenly to make room, so the row
// keeps its width. A card's strip only grows when it is exposed, so the card under the pointer
// stays under it.
export function handMargins(
    count: number,
    cardWidth: number,
    room: number,
    exposed?: number
): number[] {
    if (count === 0) {
        return []
    }
    const gaps = count - 1
    const step = Math.min(cardWidth, gaps > 0 ? (room - cardWidth) / gaps : cardWidth)
    const wanted = cardWidth * ExposedShare
    // The last card is never covered, so only an earlier one needs room.
    const widened =
        exposed !== undefined && exposed >= 0 && exposed < gaps && gaps > 1 && step < wanted
    const others = widened ? (gaps * step - wanted) / (gaps - 1) : step
    return Array.from({ length: count }, (_, index) => {
        if (index === 0) {
            return 0
        }
        return (widened && index === exposed! + 1 ? wanted : others) - cardWidth
    })
}
