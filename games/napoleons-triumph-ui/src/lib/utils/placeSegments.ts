export type PlaceSegment = { text: string } | { text: string; locale: number }

function escaped(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The longest name is tried first, so `locale 13` is never read in `locale 131`. */
export function placeSegments(text: string, names: ReadonlyMap<string, number>): PlaceSegment[] {
    if (names.size === 0) {
        return [{ text }]
    }
    const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])(${[...names.keys()]
            .toSorted((a, b) => b.length - a.length)
            .map(escaped)
            .join('|')})(?![\\p{L}\\p{N}])`,
        'gu'
    )
    const segments: PlaceSegment[] = []
    let from = 0
    for (const match of text.matchAll(pattern)) {
        const locale = names.get(match[0])
        if (locale === undefined) {
            continue
        }
        if (match.index > from) {
            segments.push({ text: text.slice(from, match.index) })
        }
        segments.push({ text: match[0], locale })
        from = match.index + match[0].length
    }
    if (from < text.length) {
        segments.push({ text: text.slice(from) })
    }
    return segments
}
