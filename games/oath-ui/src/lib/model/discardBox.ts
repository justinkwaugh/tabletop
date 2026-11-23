/** A place counted from the top of a pile: "1st", "2nd", "3rd", "4th" … "11th" … "21st". */
export function placeName(place: number): string {
    const teen = place % 100 >= 11 && place % 100 <= 13
    const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th')
    return `${place}${suffix}`
}

/** What the box beside a discard pile says. */
export interface DiscardBoxLines {
    count: string
    unit: 'card' | 'cards'
    /** Present only while the pile holds a Vision whose place is known. */
    visions?: { word: 'Vision' | 'Visions'; places: string }
    /** The whole box in words, for a screen reader. */
    label: string
}

/**
 * R-9.4 — a pile's count, and where its Visions lie from the top, from their backs: never which
 * Vision. `places` is undefined when the table's record does not show every back (an older game),
 * and the box then says the count alone, as for a pile with no Vision.
 */
export function discardBoxLines(
    pileName: string,
    count: number,
    places: readonly number[] | undefined
): DiscardBoxLines {
    const unit = count === 1 ? 'card' : 'cards'
    const counted = `${pileName}: ${count} ${unit}`
    if (places === undefined || places.length === 0)
        return { count: `${count}`, unit, label: counted }
    const word = places.length === 1 ? 'Vision' : 'Visions'
    const named = places.map(placeName)
    return {
        count: `${count}`,
        unit,
        visions: { word, places: named.join(', ') },
        label: `${counted}; ${word} ${named.join(' and ')} from the top`
    }
}
