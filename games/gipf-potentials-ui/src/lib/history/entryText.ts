import type { AxialCoordinates } from '@tabletop/common'
import { isPotentialKind, PieceKind, type PotentialKind } from '@tabletop/gipf-potentials'
import type { DiscKind } from '$lib/board/pieceShape.js'
import type { HistoryEntry, Taking } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'piece'; discs: DiscKind[] }
    | { kind: 'point'; coords: AxialCoordinates }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const point = (coords: AxialCoordinates): Segment => ({ kind: 'point', coords })
const piece = (...discs: DiscKind[]): Segment => ({ kind: 'piece', discs })

function pushed(kind: PieceKind, extra: boolean): Segment {
    if (kind === PieceKind.Gipf) return piece(PieceKind.Basic, PieceKind.Basic)
    if (!isPotentialKind(kind)) return piece(PieceKind.Basic)
    return extra ? piece(kind) : piece(PieceKind.Basic, kind)
}

function moved(kind: PotentialKind): string {
    switch (kind) {
        case PieceKind.Zertz:
            return 'jumped'
        case PieceKind.Yinsh:
            return 'slid'
        case PieceKind.Dvonn:
        case PieceKind.Punct:
            return 'covered with'
        case PieceKind.Tamsk:
            throw Error('A TAMSK-potential has no move of its own')
    }
}

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
export function entrySegments(entry: HistoryEntry, brief = false): Segment[] {
    const rows = brief ? briefRows(entry) : fullRows(entry)
    switch (entry.kind) {
        case 'taking':
            return rows
        case 'skip':
            return [text(' gave up the extra move'), ...rows]
        case 'move': {
            const covers = entry.piece === PieceKind.Dvonn || entry.piece === PieceKind.Punct
            const pieces = entry.cover === 2 ? 'a GIPF-piece' : 'a piece'
            return [
                text(` ${moved(entry.piece)} `),
                piece(entry.piece),
                text(' from '),
                point(entry.from),
                text(covers ? ' onto ' : ' to '),
                point(entry.to),
                ...(entry.cover !== undefined && !brief
                    ? [text(`, covering it with ${pieces}`)]
                    : []),
                ...rows
            ]
        }
        case 'push': {
            const tamsk = entry.tamskOwnerId !== undefined
            return [
                text(' pushed '),
                pushed(entry.piece, entry.extra),
                text(' from '),
                point(entry.dot),
                text(' to '),
                point(entry.to),
                ...(entry.extra ? [text(' as an extra move')] : []),
                ...(!brief && entry.shifted > 0 ? [text(`, moving ${entry.shifted}`)] : []),
                ...(tamsk && !brief ? [text(', a TAMSK piece onto E5')] : []),
                ...(entry.forfeited && !brief ? [text(', giving up its potentials')] : []),
                ...rows
            ]
        }
    }
}

function fullRows(entry: HistoryEntry): Segment[] {
    return entry.takings.flatMap((taking, index) => [
        text(index === 0 ? (entry.kind === 'taking' ? ' ' : ', then ') : ' and '),
        text(taking.left ? 'left ' : 'took '),
        point(taking.from),
        text('–'),
        point(taking.to),
        text(taking.left ? ' standing' : ` (${describe(taking)})`)
    ])
}

function briefRows(entry: HistoryEntry): Segment[] {
    const taken = entry.takings.filter((taking) => !taking.left)
    const left = entry.takings.filter((taking) => taking.left)
    const opening = entry.kind === 'taking' && taken.length === 0
    return [
        ...briefList(taken, entry.kind === 'taking' ? ' took' : ', taking', ''),
        ...briefList(left, opening ? ' left' : ', leaving', ' standing')
    ]
}

function briefList(takings: Taking[], verb: string, after: string): Segment[] {
    if (takings.length === 0) return []
    const rowWord = takings.length > 1 ? 'rows' : 'row'
    return [
        text(`${verb} ${rowWord} `),
        ...takings.flatMap((taking, index) => [
            text(index === 0 ? '' : ' and '),
            point(taking.from),
            text('–'),
            point(taking.to)
        ]),
        ...(after ? [text(after)] : [])
    ]
}

function describe(taking: Taking): string {
    const parts = []
    if (taking.returned > 0) parts.push(`${taking.returned} back`)
    if (taking.captured > 0) {
        const gipf = taking.capturedGipf > 0 ? ` incl. ${taking.capturedGipf} GIPF` : ''
        parts.push(`captured ${taking.captured}${gipf}`)
    }
    return parts.length > 0 ? parts.join(', ') : 'potentials only'
}
