import { systemName } from './presentation.js'

// Text that names a system carries a reference to it, `{system:alpha-centauri}`, so the system
// can be shown as a link that zooms the map into it. `plainSystemText` turns the references
// back into names for tooltips and labels.
export type SystemTextSegment = { text: string } | { systemId: string }

const SystemReferencePattern = /\{system:([a-z0-9-]+)\}/g

export function systemRef(systemId: string): string {
    return `{system:${systemId}}`
}

export function systemTextSegments(text: string): SystemTextSegment[] {
    const segments: SystemTextSegment[] = []
    let from = 0
    for (const match of text.matchAll(SystemReferencePattern)) {
        if (match.index > from) segments.push({ text: text.slice(from, match.index) })
        segments.push({ systemId: match[1] })
        from = match.index + match[0].length
    }
    if (from < text.length) segments.push({ text: text.slice(from) })
    return segments
}

export function plainSystemText(text: string): string {
    return text.replace(SystemReferencePattern, (_, systemId: string) => systemName(systemId))
}
