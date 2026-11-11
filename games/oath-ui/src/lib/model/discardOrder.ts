// R-10.5 — the player's order, last on top; untapped cards follow in hand order.

export function discardOrderOf(tapped: readonly string[], others: readonly string[]): string[] {
    return [
        ...tapped.filter((id) => others.includes(id)),
        ...others.filter((id) => !tapped.includes(id))
    ]
}

export function isDiscardOrderComplete(
    tapped: readonly string[],
    others: readonly string[]
): boolean {
    return (
        others.length <= 1 || tapped.filter((id) => others.includes(id)).length >= others.length - 1
    )
}

function ordinal(index: number): string {
    return `${index + 1}${['st', 'nd', 'rd'][index] ?? 'th'}`
}

/** `underTop`: cards already lie on the pile above where these go (Land Warden, R-7.3.3). */
export function discardPositionLabel(
    cardId: string,
    tapped: readonly string[],
    others: readonly string[],
    underTop = false
): string {
    const order = discardOrderOf(tapped, others)
    const index = order.indexOf(cardId)
    if (!isDiscardOrderComplete(tapped, others)) {
        if (!tapped.includes(cardId)) return ''
        return index === 0 ? 'bottom' : ordinal(index)
    }
    if (order.length === 1) return 'discarded'
    if (index === order.length - 1) return underTop ? 'under top' : 'on top'
    return index === 0 ? 'bottom' : ordinal(index)
}
