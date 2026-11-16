import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { PieceKind } from '@tabletop/punct'
import type { HistoryEntry } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'piece'; piece: PieceKind }
    | { kind: 'point'; coords: AxialCoordinates }
    | { kind: 'player'; playerId: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const point = (coords: AxialCoordinates): Segment => ({ kind: 'point', coords })

// Where a moved piece came to rest, when its level changed: level 1 lies on one piece.
function levelChange(from: number, to: number): string {
    if (from === to) return ''
    if (to === 0) return ', down to the board'
    return `, ${to > from ? 'up' : 'down'} to level ${to}`
}

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: HistoryEntry, brief = false): Segment[] {
    const passed: Segment[] =
        entry.passedPlayerId === undefined
            ? []
            : [text('; '), { kind: 'player', playerId: entry.passedPlayerId }, text(' passed')]
    if (entry.kind === 'place') {
        return [
            text(' placed '),
            { kind: 'piece', piece: entry.piece },
            text(' at '),
            point(entry.at),
            ...passed
        ]
    }
    if (sameCoordinates(entry.from, entry.to)) {
        return [
            text(' turned '),
            { kind: 'piece', piece: entry.piece },
            text(' at '),
            point(entry.to),
            ...passed
        ]
    }
    return [
        text(' moved '),
        { kind: 'piece', piece: entry.piece },
        text(' from '),
        point(entry.from),
        text(' to '),
        point(entry.to),
        ...(brief && entry.level === entry.fromLevel
            ? []
            : [text(levelChange(entry.fromLevel, entry.level))]),
        ...passed
    ]
}
