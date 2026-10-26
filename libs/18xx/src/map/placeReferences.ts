export type PlaceTextSegment = { text: string } | { locationId: string }

const PlaceReferencePattern = /\{([^{}]+)\}/g

export function placeReference(locationId: string): string {
    return `{${locationId}}`
}

export function placeTextSegments(text: string): PlaceTextSegment[] {
    const segments: PlaceTextSegment[] = []
    let from = 0
    for (const match of text.matchAll(PlaceReferencePattern)) {
        if (match.index > from) segments.push({ text: text.slice(from, match.index) })
        segments.push({ locationId: match[1] })
        from = match.index + match[0].length
    }
    if (from < text.length) segments.push({ text: text.slice(from) })
    return segments
}

export function namedPlaceText(text: string, placeName: (locationId: string) => string): string {
    return text.replace(PlaceReferencePattern, (_, locationId: string) => placeName(locationId))
}
