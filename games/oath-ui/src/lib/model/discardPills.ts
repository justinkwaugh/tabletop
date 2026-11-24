/** A place counted from the top of a pile: "1st", "2nd", "3rd", "4th" … "11th" … "21st". */
export function placeName(place: number): string {
    const teen = place % 100 >= 11 && place % 100 <= 13
    const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th')
    return `${place}${suffix}`
}

/** What the pills on a discard pile say. */
export interface DiscardPills {
    /** The count pill on the pile's right. */
    count: string
    /** The places pill above the pile ("3 · 8 · 11"), only while it holds a Vision whose place is known. */
    places?: string
    /** Both pills in words, for a screen reader. */
    label: string
}

/** "3rd", "3rd and 8th", "3rd, 8th and 11th". */
function spokenList(words: readonly string[]): string {
    const last = words.at(-1) ?? ''
    return words.length < 2 ? last : `${words.slice(0, -1).join(', ')} and ${last}`
}

/**
 * R-9.4 — a pile's count, and where its Visions lie from the top, from their backs: never which
 * Vision. `places` is undefined when the table's record does not show every back (an older game),
 * and the pile then wears its count alone, as a pile with no Vision does.
 */
export function discardPills(
    pileName: string,
    count: number,
    places: readonly number[] | undefined
): DiscardPills {
    const counted = `${pileName}: ${count} ${count === 1 ? 'card' : 'cards'}`
    if (places === undefined || places.length === 0) return { count: `${count}`, label: counted }
    const word = places.length === 1 ? 'Vision' : 'Visions'
    return {
        count: `${count}`,
        places: places.join(' · '),
        label: `${counted}; ${word} ${spokenList(places.map(placeName))} from the top`
    }
}
