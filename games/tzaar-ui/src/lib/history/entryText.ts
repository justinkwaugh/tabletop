import type { AxialCoordinates } from '@tabletop/common'
import { PieceKind } from '@tabletop/tzaar'
import type { HistoryEntry, StackSummary } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'space'; coords: AxialCoordinates }
    | { kind: 'player'; playerId: string }

export const KIND_NAMES: Record<PieceKind, string> = {
    [PieceKind.Tzaar]: 'Tzaar',
    [PieceKind.Tzarra]: 'Tzarra',
    [PieceKind.Tott]: 'Tott'
}

const PLURAL_NAMES: Record<PieceKind, string> = {
    [PieceKind.Tzaar]: 'Tzaars',
    [PieceKind.Tzarra]: 'Tzarras',
    [PieceKind.Tott]: 'Totts'
}

const text = (value: string): Segment => ({ kind: 'text', text: value })
const space = (coords: AxialCoordinates): Segment => ({ kind: 'space', coords })
const player = (playerId: string): Segment => ({ kind: 'player', playerId })

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: HistoryEntry, brief = false): Segment[] {
    const stuck = entry.stuckPlayerId === undefined ? [] : stuckSegments(entry.stuckPlayerId, brief)
    switch (entry.kind) {
        case 'place':
            return [text(` placed a ${KIND_NAMES[entry.piece]} on `), space(entry.coords), ...stuck]
        case 'capture':
            return [
                text(brief ? ' captured ' : ` moved ${stackOf(entry.moved)} from `),
                ...(brief ? [] : [space(entry.from), text(' and captured ')]),
                text(`${stackOf(entry.captured)} on `),
                space(entry.to),
                ...(entry.eliminated === undefined
                    ? []
                    : [text(`, taking the last of the ${PLURAL_NAMES[entry.eliminated]}`)]),
                ...(!brief && entry.noSecondMove ? [text('; nothing left for a second move')] : []),
                ...stuck
            ]
        case 'stack':
            return [
                text(` stacked ${stackOf(entry.moved)} from `),
                space(entry.from),
                text(' onto '),
                space(entry.to),
                text(`, making ${entry.moved.height + entry.landedOn.height}`),
                ...stuck
            ]
        case 'pass':
            return [text(' passed the second move'), ...stuck]
    }
}

function stuckSegments(playerId: string, brief: boolean): Segment[] {
    return [
        text('; '),
        player(playerId),
        text(brief ? ' cannot capture' : ' cannot capture and loses')
    ]
}

// "a Tott", or "a Tzaar stack of 3" for a stack of three topped by a Tzaar.
function stackOf({ height, kind }: StackSummary): string {
    const name = kind === undefined ? 'piece' : KIND_NAMES[kind]
    return height === 1 ? `a ${name}` : `a ${name} stack of ${height}`
}
