import type { AxialCoordinates } from '@tabletop/common'
import { PieceKind } from '@tabletop/matrx'
import type { HistoryEntry, Taking } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'piece'; piece: PieceKind; discs: number }
    | { kind: 'point'; coords: AxialCoordinates }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const point = (coords: AxialCoordinates): Segment => ({ kind: 'point', coords })

// What each potential's move is called.
const MOVED: Partial<Record<PieceKind, string>> = {
    [PieceKind.Zertz]: 'jumped',
    [PieceKind.Yinsh]: 'slid',
    [PieceKind.Dvonn]: 'covered with',
    [PieceKind.Punct]: 'covered with'
}

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: HistoryEntry, brief = false): Segment[] {
    const rows = brief ? briefRows(entry) : fullRows(entry)
    switch (entry.kind) {
        case 'taking':
            return rows
        case 'skip':
            return [text(' gave up the extra move'), ...rows]
        case 'move': {
            const covers = entry.piece === PieceKind.Dvonn || entry.piece === PieceKind.Punct
            return [
                text(` ${MOVED[entry.piece] ?? 'moved'} `),
                { kind: 'piece', piece: entry.piece, discs: 1 },
                text(' from '),
                point(entry.from),
                text(covers ? ' onto ' : ' to '),
                point(entry.to),
                ...rows
            ]
        }
        case 'push': {
            const discs = entry.extra || entry.piece === PieceKind.Gipf ? 1 : 2
            const tamsk = entry.tamskOwnerId !== undefined
            return [
                text(' pushed '),
                { kind: 'piece', piece: entry.piece, discs },
                text(' from '),
                point(entry.dot),
                text(' to '),
                point(entry.to),
                ...(entry.extra ? [text(' as an extra move')] : []),
                ...(!brief && entry.shifted > 0 ? [text(`, moving ${entry.shifted}`)] : []),
                ...(tamsk && !brief ? [text(', a TAMSK stack onto E5')] : []),
                ...rows
            ]
        }
    }
}

function fullRows(entry: HistoryEntry): Segment[] {
    return entry.takings.flatMap((taking, index) => [
        text(index === 0 ? (entry.kind === 'taking' ? ' took ' : ', then took ') : ' and '),
        point(taking.from),
        text('–'),
        point(taking.to),
        text(` (${describe(taking)})`)
    ])
}

function briefRows(entry: HistoryEntry): Segment[] {
    const rows = entry.takings.flatMap((taking, index) => [
        text(index === 0 ? '' : ' and '),
        point(taking.from),
        text('–'),
        point(taking.to)
    ])
    if (rows.length === 0) return []
    const rowWord = entry.takings.length > 1 ? 'rows' : 'row'
    return entry.kind === 'taking'
        ? [text(` took ${rowWord} `), ...rows]
        : [text(`, taking ${rowWord} `), ...rows]
}

function describe(taking: Taking): string {
    const parts = []
    if (taking.returned > 0) parts.push(`${taking.returned} back`)
    if (taking.captured > 0) {
        const gipf = taking.capturedGipf > 0 ? ` incl. ${taking.capturedGipf} GIPF` : ''
        parts.push(`captured ${taking.captured}${gipf}`)
    }
    return parts.length > 0 ? parts.join(', ') : 'all stacks kept'
}
