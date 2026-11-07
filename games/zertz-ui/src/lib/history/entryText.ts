import type { AxialCoordinates } from '@tabletop/common'
import type { MarbleColor } from '@tabletop/zertz'
import type { HistoryEntry } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'marble'; color: MarbleColor }
    | { kind: 'ring'; coords: AxialCoordinates }
    | { kind: 'step' }

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks. The
// brief form keeps the action panel's message to one line on a phone, as the other titles do:
// a capture chain by where it began and ended, claims by their marbles alone, and no word of
// where a placed marble came from. The history panel reads the full one.
export function entrySegments(entry: HistoryEntry, isMe: boolean, brief = false): Segment[] {
    const text = (value: string): Segment => ({ kind: 'text', text: value })
    const marble = (color: MarbleColor): Segment => ({ kind: 'marble', color })
    const ring = (coords: AxialCoordinates): Segment => ({ kind: 'ring', coords })

    if (entry.kind === 'capture') {
        return [
            text(' jumped '),
            marble(entry.jumper),
            text(' '),
            ...(brief ? [entry.path[0], entry.path[entry.path.length - 1]] : entry.path).flatMap(
                (coords, index) =>
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
        ...(entry.fromCaptures && !brief
            ? [text(` from ${isMe ? 'your' : 'their'} captures`)]
            : []),
        ...(entry.removedAt ? [text(', removed '), ring(entry.removedAt)] : []),
        ...(entry.claimed.length > 0 ? [text(brief ? ' and claimed ' : ' and claimed')] : []),
        ...entry.claimed.flatMap((claimed) => {
            if (claimed.marble === undefined) return []
            if (brief) return [marble(claimed.marble)]
            return [text(' '), marble(claimed.marble), text(' '), ring(claimed.coords)]
        })
    ]
}
