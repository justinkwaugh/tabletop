import type { AxialCoordinates } from '@tabletop/common'
import type { MarbleColor } from '@tabletop/zertz'
import type { HistoryEntry } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'marble'; color: MarbleColor }
    | { kind: 'ring'; coords: AxialCoordinates }
    | { kind: 'step' }

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
export function entrySegments(entry: HistoryEntry, isMe: boolean): Segment[] {
    const text = (value: string): Segment => ({ kind: 'text', text: value })
    const marble = (color: MarbleColor): Segment => ({ kind: 'marble', color })
    const ring = (coords: AxialCoordinates): Segment => ({ kind: 'ring', coords })

    if (entry.kind === 'capture') {
        return [
            text(' jumped '),
            marble(entry.jumper),
            text(' '),
            ...entry.path.flatMap((coords, index) =>
                index === 0 ? [ring(coords)] : [{ kind: 'step' } as const, ring(coords)]
            ),
            text(', capturing '),
            ...entry.captured.map(marble)
        ]
    }

    return [
        text(' placed '),
        marble(entry.color),
        text(' on '),
        ring(entry.placedAt),
        ...(entry.fromCaptures ? [text(` from ${isMe ? 'your' : 'their'} captures`)] : []),
        ...(entry.removedAt ? [text(', removed '), ring(entry.removedAt)] : []),
        ...(entry.claimed.length > 0 ? [text(' and claimed')] : []),
        ...entry.claimed.flatMap((claimed) =>
            claimed.marble === undefined
                ? []
                : [text(' '), marble(claimed.marble), text(' '), ring(claimed.coords)]
        )
    ]
}
