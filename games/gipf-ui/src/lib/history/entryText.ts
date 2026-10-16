import type { AxialCoordinates } from '@tabletop/common'
import type { HistoryEntry, Taking } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'piece'; gipf: boolean }
    | { kind: 'point'; coords: AxialCoordinates }

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
export function entrySegments(entry: HistoryEntry): Segment[] {
    const text = (value: string): Segment => ({ kind: 'text', text: value })
    const point = (coords: AxialCoordinates): Segment => ({ kind: 'point', coords })

    const takings = entry.takings.flatMap((taking, index) => [
        text(index === 0 ? (entry.kind === 'push' ? ', then took ' : ' took ') : ' and '),
        point(taking.from),
        text('–'),
        point(taking.to),
        text(` (${describe(taking)})`)
    ])

    if (entry.kind === 'taking') {
        return takings
    }
    return [
        text(' pushed '),
        { kind: 'piece', gipf: entry.gipf },
        text(' from '),
        point(entry.dot),
        text(' to '),
        point(entry.to),
        ...(entry.shifted > 0 ? [text(`, moving ${entry.shifted}`)] : []),
        ...takings
    ]
}

function describe(taking: Taking): string {
    const parts = []
    if (taking.returned > 0) parts.push(`${taking.returned} back`)
    if (taking.captured > 0) {
        const gipf = taking.capturedGipf > 0 ? ` incl. ${taking.capturedGipf} GIPF` : ''
        parts.push(`captured ${taking.captured}${gipf}`)
    }
    return parts.join(', ')
}
